/**
 * workspace 目录发现。
 *
 * @remarks 原实现每次访问包元数据都会重新 find + 逐包 jq 解析；这里把每个 scope
 * 的扫描结果缓存在实例上，拓扑排序与发布校验会反复读取同一份目录。
 */
import { readdirSync } from "node:fs"
import path from "node:path"

import { isPublishable, type PackageManifest, readManifestSafe } from "./package-json.ts"

/** 目录层级在交互控件中的显示名。 */
const SCOPE_LABELS: Readonly<Record<string, string>> = {
  packages: "Packages",
  plugins: "Plugins",
  examples: "Examples",
}

/** 项目内稳定的 scope 顺序。 */
export const WORKSPACE_SCOPES = ["packages", "plugins", "examples"] as const

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
 * 返回目录层级在树形选择控件中的显示名。
 *
 * @param scope - 目录层级。
 * @returns 显示名。
 */
export function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope
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
