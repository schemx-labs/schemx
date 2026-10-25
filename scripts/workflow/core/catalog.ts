/**
 * workspace 目录发现。
 *
 * @remarks 原实现每次访问包元数据都会重新 find + 逐包 jq 解析；这里把每个 scope
 * 的扫描结果缓存在实例上，拓扑排序与发布校验会反复读取同一份目录。
 */
import { execFile } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { setImmediate } from "node:timers/promises"
import { promisify } from "node:util"

import { WORKFLOW_SCOPE_LABEL } from "../display-config.ts"

import { isPublishable, type PackageManifest, readManifestSafe } from "./package-json.ts"

// Git 查询使用异步子进程，等待期间允许终端刷新。
const executeFile = promisify(execFile)

/** 项目内稳定的 scope 顺序。 */
export const WORKSPACE_SCOPES = ["packages", "plugins", "examples", "scripts"] as const

/** workspace scope 名称。 */
export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number]

/** 一个被发现的 workspace 包。 */
export interface WorkspacePackage {
  /** 所属目录层级，例如 `packages`。 */
  readonly scope: string
  /** 目录名，例如 `core`。 */
  readonly directory: string
  /** 相对仓库根的目录，例如 `packages/core`。 */
  readonly relativeDir: string
  /** npm 包名，例如 `@schemx/core`。 */
  readonly name: string
  /** package.json 绝对路径。 */
  readonly manifestPath: string
  /** 已解析的清单。 */
  readonly manifest: PackageManifest
}

/**
 * 根据实际文件生成的代码目录，不要求目录声明 npm script。
 */
export interface SourceDirectory {
  /** 交互列表中的分组。 */
  readonly scope: string
  /** 可用于选择目标的目录简称。 */
  readonly directory: string
  /** 相对仓库根目录的路径；根目录使用 "."。 */
  readonly relativeDir: string
  /** 包名或目录路径。 */
  readonly name: string
  /** 本目录的文件，不包含其他目标拥有的文件。 */
  readonly files: string[]
}

/**
 * 返回目录层级在树形选择控件中的显示名。
 *
 * @param scope - 目录层级。
 * @returns 显示名。
 */
export function scopeLabel(scope: string): string {
  return WORKFLOW_SCOPE_LABEL[scope] ?? scope
}

/**
 * workspace 目录索引。按 scope 缓存扫描结果。
 */
export class Catalog {
  readonly #root: string
  readonly #scopes = new Map<string, readonly WorkspacePackage[]>()

  /**
   * @param root - 仓库根目录。
   */
  constructor(root: string) {
    this.#root = root
  }

  /**
   * 按给定顺序发现 scope 下的所有包。缺失的 scope 视为空。
   *
   * @param scopes - 目录层级列表。
   * @returns 稳定排序的包列表。
   */
  discover(scopes: readonly string[] = WORKSPACE_SCOPES): readonly WorkspacePackage[] {
    const packages: WorkspacePackage[] = []

    for (const scope of scopes) {
      packages.push(...this.#scanScope(scope))
    }

    return packages
  }

  /**
   * 按包目录或顶层目录归组实际文件，包含未跟踪文件并遵循 Git 忽略配置。
   *
   * @returns 不依赖固定 scope 或 package script 的目录列表。
   * @example
   * const directories = await new Catalog(root).discoverSources()
   */
  async discoverSources(): Promise<readonly SourceDirectory[]> {
    // 使用 Git 的文件清单，避免遍历依赖、构建输出和被忽略的目录。
    const { stdout: output } = await executeFile(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: this.#root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    )

    // 跳过隐藏目录和已从工作区删除的索引文件，保留根目录配置文件。
    const files: string[] = []

    for (const [index, file] of [...new Set(output.split("\0"))].entries()) {
      // 大型仓库分批归组，避免文件状态查询连续占用事件循环。
      if (index % 64 === 0) {
        await setImmediate()
      }

      if (
        file &&
        !file
          .split("/")
          .slice(0, -1)
          .some((directory) => directory.startsWith(".")) &&
        statSync(path.join(this.#root, file), { throwIfNoEntry: false })?.isFile()
      ) {
        files.push(file)
      }
    }

    files.sort()

    // 优先归入最近的包目录，保留 core、vue 等已有目标简称。
    const packages = files
      .filter((file) => file.endsWith("/package.json"))
      .map((file) => path.posix.dirname(file))
      .sort((left, right) => right.length - left.length)

    // 根目录文件单独归组，避免选择根目录时重复处理所有子目录。
    const directories = new Map<string, SourceDirectory>()

    for (const [index, file] of files.entries()) {
      if (index % 64 === 0) {
        await setImmediate()
      }

      let relativeDir = packages.find((directory) => file.startsWith(directory + "/"))

      if (!relativeDir) {
        relativeDir = file.includes("/") ? (file.split("/")[0] ?? ".") : "."
      }

      let item = directories.get(relativeDir)

      if (!item) {
        const manifest = readManifestSafe(
          path.join(this.#root, relativeDir, "package.json")
        )

        item = {
          scope: relativeDir.split("/")[0] ?? ".",
          directory: path.posix.basename(relativeDir),
          relativeDir,
          name: manifest?.name ?? relativeDir,
          files: [],
        }
        directories.set(relativeDir, item)
      }

      item.files.push(file)
    }

    return [...directories.values()].sort((left, right) =>
      left.relativeDir.localeCompare(right.relativeDir)
    )
  }

  /**
   * 返回可公开发布的包，复用同一次扫描结果。
   *
   * @returns 可发布包列表。
   */
  publishable(): readonly WorkspacePackage[] {
    return this.discover(["packages", "plugins"]).filter((item) =>
      isPublishable(item.manifest)
    )
  }

  /**
   * 按标识符查找包：接受 `scope/directory`、`directory` 或 npm 包名。
   *
   * @param identifier - 目标标识符。
   * @param candidates - 候选包列表，默认全部可发布包。
   * @returns 匹配到的包，或 undefined。
   */
  find(
    identifier: string,
    candidates: readonly WorkspacePackage[] = this.publishable()
  ): WorkspacePackage | undefined {
    return candidates.find(
      (item) =>
        item.relativeDir === identifier ||
        item.directory === identifier ||
        item.name === identifier
    )
  }

  /**
   * 按给定判定筛选包，用于任务目标发现。
   *
   * @param candidates - 候选包列表。
   * @param hasScript - 用于判断包是否具备目标 script 的函数。
   * @returns 满足条件的包。
   */
  static withScript(
    candidates: readonly WorkspacePackage[],
    hasScript: (manifest: PackageManifest) => boolean
  ): readonly WorkspacePackage[] {
    return candidates.filter((item) => hasScript(item.manifest))
  }

  /**
   * 扫描单个 scope，结果缓存到实例上。
   *
   * @param scope - 目录层级。
   * @returns 包列表。
   */
  #scanScope(scope: string): readonly WorkspacePackage[] {
    const cached = this.#scopes.get(scope)

    if (cached) {
      return cached
    }

    const scopeDir = path.join(this.#root, scope)

    const packages: WorkspacePackage[] = []

    let directories: string[] = []

    try {
      directories = readdirSync(scopeDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    } catch {
      this.#scopes.set(scope, packages)

      return packages
    }

    for (const directory of directories) {
      const manifestPath = path.join(scopeDir, directory, "package.json")

      const manifest = readManifestSafe(manifestPath)

      if (!manifest?.name) {
        continue
      }

      packages.push({
        scope,
        directory,
        relativeDir: `${scope}/${directory}`,
        name: manifest.name,
        manifestPath,
        manifest,
      })
    }

    this.#scopes.set(scope, packages)

    return packages
  }
}

/**
 * 按 workspace 内部依赖做拓扑排序，保证被依赖的包排在前面。
 *
 * @param packages - 待排序的包列表。
 * @param dependenciesOf - 返回某个包的内部依赖 **npm 包名** 列表。
 * @returns 拓扑顺序；同一层保持输入顺序，环依赖按输入顺序兜底。
 */
export function orderByDependencies(
  packages: readonly WorkspacePackage[],
  dependenciesOf: (item: WorkspacePackage) => readonly string[]
): readonly WorkspacePackage[] {
  if (packages.length === 0) {
    return []
  }

  const byName = new Map(packages.map((item) => [item.name, item]))

  const pending = [...packages]

  const ordered: WorkspacePackage[] = []

  const done = new Set<string>()

  let progressed = true

  while (progressed) {
    progressed = false
    const stillPending: WorkspacePackage[] = []

    for (const item of pending) {
      const blocked = dependenciesOf(item)
        .map((name) => byName.get(name))
        .some((dependency) => dependency !== undefined && !done.has(dependency.name))

      if (blocked) {
        stillPending.push(item)
        continue
      }

      ordered.push(item)
      done.add(item.name)
      progressed = true
    }

    if (stillPending.length === 0) {
      break
    }

    pending.length = 0
    pending.push(...stillPending)
  }

  for (const item of pending) {
    if (!done.has(item.name)) {
      ordered.push(item)
      done.add(item.name)
    }
  }

  return ordered
}
