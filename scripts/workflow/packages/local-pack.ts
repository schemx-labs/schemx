/**
 * 本地 tarball 打包。
 *
 * @remarks 原实现分 orchestrate 与 leaf 两种执行形态，用 TSV 结果文件、stdout 哨兵行
 * 和互相覆盖的 trap 在父子进程间传递产物路径，并把依赖图硬编码成三条 if 分支。
 * 这里统一为一条路径：解析目标 → 按 package.json 推导依赖闭包 → 统一 dev 版本 →
 * 逐个 build + pack → 恢复版本 → 返回结构化产物。
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  type Catalog,
  orderByDependencies,
  type WorkspacePackage,
} from "../core/catalog.ts"
import { failure, usageError } from "../core/errors.ts"
import {
  type PackageManifest,
  readManifestSafe,
  writeManifest,
} from "../core/package-json.ts"
import { type Ui } from "../ui/ui.ts"

/** 一次本地打包的产物。 */
export interface PackResult {
  /** 产物目录。 */
  readonly directory: string
  /** 生成的 tarball 路径。 */
  readonly tarballs: readonly string[]
}

/** 本地打包选项。 */
export interface PackOptions {
  /** 仓库根目录。 */
  readonly root: string
  /** 目录索引。 */
  readonly catalog: Catalog
  /** 终端 UI。 */
  readonly ui: Ui
  /** 逗号分隔的目标；`all` 或空串表示全部可打包目标。 */
  readonly targets: string
  /** 输出目录。 */
  readonly outputDir: string
}

/** 一个可打包的目标。 */
interface PackableTarget {
  /** 相对目录，例如 `packages/core` 或 `plugins/foo`。 */
  readonly relativeDir: string
  /** 目录名。 */
  readonly directory: string
  /** npm 包名。 */
  readonly name: string
  /** package.json 绝对路径。 */
  readonly manifestPath: string
}

/** 当前时间的紧凑时间戳，用于 dev 版本号。 */
function timestamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14)
}

/**
 * 判断包是否可参与本地打包：workspace 包一律可打包，插件目录需要提供 pack:local。
 *
 * @param item - workspace 包。
 * @returns 是否可打包。
 */
function isPackable(item: WorkspacePackage): boolean {
  return item.scope === "packages" || item.manifest.scripts?.["pack:local"] !== undefined
}

/**
 * 把请求的目标解析为可打包目标列表。
 *
 * @param catalog - 目录索引。
 * @param requested - 逗号分隔的目标。
 * @returns 命中的目标，保持请求顺序。
 * @throws {WorkflowError} 存在未知目标时抛出。
 */
function resolveRequested(
  catalog: Catalog,
  requested: string
): readonly PackableTarget[] {
  const eligible = catalog
    .discover(["packages", "plugins"])
    .filter(isPackable)
    .map((item) => ({
      relativeDir: item.relativeDir,
      directory: item.directory,
      name: item.name,
      manifestPath: item.manifestPath,
    }))

  if (requested === "" || requested === "all") {
    return eligible
  }

  const selected: PackableTarget[] = []

  for (const identifier of requested.split(",").filter((item) => item !== "")) {
    const matched = eligible.filter(
      (item) =>
        item.relativeDir === identifier ||
        item.directory === identifier ||
        item.name === identifier
    )

    if (matched.length === 0) {
      throw usageError(`存在未知或不可打包的目标：${identifier}`)
    }

    selected.push(...matched)
  }

  if (selected.length === 0) {
    throw usageError("没有匹配到可打包的目标。")
  }

  return selected
}

/**
 * 返回包声明的内部 workspace 依赖名。
 *
 * @param manifest - 包清单。
 * @returns 依赖的 npm 包名列表。
 */
function internalDependencies(manifest: PackageManifest): readonly string[] {
  const specifiers = { ...manifest.dependencies, ...manifest.optionalDependencies }

  return Object.keys(specifiers).filter((name) =>
    String(specifiers[name]).startsWith("workspace:")
  )
}

/**
 * 把选中的 workspace 目标扩展为依赖闭包，并按拓扑顺序排列。
 *
 * @remarks 原实现把依赖关系硬编码为「vue/vant/element-plus 依赖 core」等三条 if；
 * 这里直接读取 package.json 声明，新增内部依赖无需改代码。
 *
 * @param candidates - 全部可打包的 workspace 包。
 * @param selected - 选中的目录名集合。
 * @returns 闭包内的包，按拓扑顺序。
 */
function expandClosure(
  candidates: readonly WorkspacePackage[],
  selected: ReadonlySet<string>
): readonly WorkspacePackage[] {
  const byName = new Map(candidates.map((item) => [item.name, item]))

  const byDirectory = new Map(candidates.map((item) => [item.directory, item]))

  const needed = new Set<string>()

  const queue = [...selected]

  while (queue.length > 0) {
    const current = queue.pop()

    if (current === undefined || needed.has(current)) {
      continue
    }

    needed.add(current)

    for (const name of internalDependencies(byDirectory.get(current)?.manifest ?? {})) {
      const dependency = byName.get(name)

      if (dependency && !needed.has(dependency.directory)) {
        queue.push(dependency.directory)
      }
    }
  }

  const chosen = candidates.filter((item) => needed.has(item.directory))

  // orderByDependencies 以 npm 包名为键解析依赖，这里必须返回包名而不是目录名，
  // 否则依赖永远解析不到，排序会静默退化成目录字典序。
  return orderByDependencies(chosen, (item) => internalDependencies(item.manifest))
}

/**
 * 解析 `pnpm pack --json` 的输出。
 *
 * @param raw - 命令标准输出。
 * @param packageName - npm 包名。
 * @returns tarball 文件名。
 * @throws {WorkflowError} 输出中缺少 filename 时抛出。
 */
function tarballName(raw: string, packageName: string): string {
  const parsed: unknown = raw.trim() === "" ? undefined : JSON.parse(raw)

  const first = Array.isArray(parsed) ? parsed[0] : parsed

  const filename = (first as { filename?: unknown } | undefined)?.filename

  if (typeof filename !== "string" || filename === "") {
    throw failure(`${packageName} 的 pnpm pack 结果中缺少 filename`)
  }

  return filename
}

/**
 * 解析插件打包脚本输出的 tarball 哨兵行。
 *
 * @param output - 子进程输出。
 * @param packageName - npm 包名。
 * @returns tarball 路径。
 * @throws {WorkflowError} 输出中没有哨兵行时抛出。
 */
function pluginTarball(output: string, packageName: string): string {
  const prefix = "__SCHEMX_LOCAL_TARBALL__="

  const sentinel = output
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .at(-1)

  if (sentinel === undefined) {
    throw failure(`${packageName} 打包完成后未返回本地 tarball 路径`)
  }

  return sentinel.slice(prefix.length).trim()
}

/**
 * 打包期间被改写的 package.json 备份。
 *
 * @remarks 原实现依赖 `trap` 在信号到达时恢复版本，且该 trap 会覆盖 UI 层的 trap；
 * 这里用 try/finally 保证任何退出路径都恢复，UI 层的信号处理不受影响。
 */
class VersionBackup {
  readonly #directory: string
  readonly #entries: readonly { readonly key: string; readonly manifestPath: string }[]

  /**
   * @param entries - 需要备份的 package.json，key 用于生成互不冲突的备份文件名。
   */
  constructor(
    entries: readonly { readonly key: string; readonly manifestPath: string }[]
  ) {
    this.#directory =
      entries.length === 0 ? "" : mkdtempSync(path.join(tmpdir(), "schemx-pack-backup-"))
    this.#entries = entries.map((entry) => {
      // 所有 manifest 都叫 package.json，必须用包标识做文件名，否则备份互相覆盖。
      cpSync(entry.manifestPath, path.join(this.#directory, `${entry.key}.json`))

      return entry
    })
  }

  /**
   * 恢复全部被改写的 package.json 并删除备份。
   */
  restore(): void {
    if (this.#directory === "") {
      return
    }

    for (const entry of this.#entries) {
      const source = path.join(this.#directory, `${entry.key}.json`)

      if (existsSync(source)) {
        cpSync(source, entry.manifestPath)
      }
    }

    rmSync(this.#directory, { recursive: true, force: true })
  }
}

/**
 * 打包一个 workspace 包：先构建，再按 pnpm 的发布规则产出 tarball。
 *
 * @param options - 打包选项。
 * @param item - 目标包。
 * @returns tarball 路径。
 * @throws {WorkflowError} 构建或打包失败时抛出。
 */
async function packWorkspace(
  options: PackOptions,
  item: WorkspacePackage
): Promise<string> {
  const { root, ui, outputDir } = options

  const build = await ui.task(
    { title: `构建 ${item.name}`, itemKey: item.name, log: "live" },
    async () =>
      await ui.exec("pnpm", ["--filter", item.name, "run", "build"], { cwd: root })
  )

  if (build !== 0) {
    throw failure(`构建 ${item.name} 失败。`)
  }

  let filename = ""

  const packed = await ui.task(
    { title: `打包 ${item.name}`, itemKey: item.name, log: "live" },
    async () => {
      const result = await ui.exec(
        "pnpm",
        ["--filter", item.name, "pack", "--pack-destination", outputDir, "--json"],
        { cwd: root }
      )

      if (result.code === 0) {
        filename = tarballName(result.stdout, item.name)
      }

      return result
    }
  )

  if (packed !== 0) {
    throw failure(`打包 ${item.name} 失败。`)
  }

  return path.resolve(outputDir, filename)
}

/**
 * 打包一个插件包：插件自行提供 `pack:local` script，并通过哨兵行返回产物路径。
 *
 * @param options - 打包选项。
 * @param item - 目标包。
 * @returns tarball 路径。
 * @throws {WorkflowError} 打包失败或未返回产物时抛出。
 */
async function packPlugin(options: PackOptions, item: WorkspacePackage): Promise<string> {
  const { root, ui } = options

  let tarball = ""

  const code = await ui.task(
    { title: `打包 ${item.name}`, itemKey: item.name, log: "live" },
    async () => {
      const result = await ui.exec("pnpm", ["--filter", item.name, "run", "pack:local"], {
        cwd: root,
      })

      if (result.code === 0) {
        tarball = pluginTarball(`${result.stdout}\n${result.stderr}`, item.name)
      }

      return result
    }
  )

  if (code !== 0) {
    throw failure(`打包 ${item.name} 失败。`)
  }

  return tarball
}

/**
 * 执行本地打包。
 *
 * @param options - 打包选项。
 * @returns 打包产物。
 * @throws {WorkflowError} 目标非法或任一包打包失败时抛出。
 */
export async function packLocal(options: PackOptions): Promise<PackResult> {
  const { catalog, outputDir } = options

  const requested = resolveRequested(catalog, options.targets)

  mkdirSync(outputDir, { recursive: true })
  const tarballs: string[] = []

  const discovered = catalog.discover(["packages", "plugins"])

  const plugins = requested.filter((item) => item.relativeDir.startsWith("plugins/"))

  for (const item of plugins) {
    const entry = catalog.find(item.relativeDir, discovered)

    if (!entry) {
      throw usageError(`存在未知或不可打包的目标：${item.relativeDir}`)
    }

    tarballs.push(await packPlugin(options, entry))
  }

  const selectedDirectories = new Set(
    requested
      .filter((item) => !item.relativeDir.startsWith("plugins/"))
      .map((item) => item.directory)
  )

  if (selectedDirectories.size === 0) {
    return { directory: outputDir, tarballs }
  }

  const candidates = catalog.discover(["packages"])

  const closure = expandClosure(candidates, selectedDirectories)

  const stamp = timestamp()

  const backup = new VersionBackup(
    closure.map((item) => ({ key: item.directory, manifestPath: item.manifestPath }))
  )

  try {
    // 闭包内所有包统一使用同一 dev 时间戳版本，确保 pack 时 workspace:* 解析到一致版本。
    for (const item of closure) {
      const current = readManifestSafe(item.manifestPath)?.version

      if (!current) {
        throw failure(`无法读取 packages/${item.directory} 的当前版本`)
      }

      writeManifest(item.manifestPath, {
        ...item.manifest,
        version: `${current}-dev.${stamp}`,
      })
    }

    for (const item of closure) {
      tarballs.push(await packWorkspace(options, item))
    }
  } finally {
    backup.restore()
  }

  return { directory: outputDir, tarballs }
}

/**
 * 渲染打包结果摘要。
 *
 * @param ui - 终端 UI。
 * @param result - 打包产物。
 */
export function renderPackResult(ui: Ui, result: PackResult): void {
  ui.summary({
    title: "全部 tarball 安装命令",
    tone: "success",
    content: `已生成 ${result.tarballs.length} 个 tarball。\n产物目录：${result.directory}`,
    copy: ["pnpm i", ...result.tarballs.map((item) => JSON.stringify(item))].join(" "),
  })
}
