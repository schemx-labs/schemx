/**
 * 发布目标解析。复用 workspace 目录索引，只筛选可公开发布的包。
 */
import {
  type Catalog,
  orderByDependencies,
  type WorkspacePackage,
} from "../core/catalog.ts"
import { usageError } from "../core/errors.ts"
import { workspaceDependencyNames } from "../core/package-json.ts"
import { type GroupChoice } from "../ui/prompt.ts"

/** 目录层级在树形选择控件中的显示名。 */
const SCOPE_LABELS: Readonly<Record<string, string>> = {
  packages: "Packages",
  plugins: "Plugins",
}

/** 稳定排序的发布候选顺序。 */
const SCOPES = ["packages", "plugins"] as const

/**
 * 返回某个发布候选的内部 workspace 依赖。
 *
 * @param item - 发布候选。
 * @param catalog - 目录索引。
 * @returns 依赖的 npm 包名列表。
 */
function dependenciesOf(item: WorkspacePackage, catalog: Catalog): readonly string[] {
  const publishable = catalog.publishable()

  return workspaceDependencyNames(item.manifest).filter((name) =>
    publishable.some((candidate) => candidate.name === name)
  )
}

/**
 * 返回某个包已发布的 workspace 依赖当前版本。
 *
 * @param npmName - 依赖的 npm 包名。
 * @param catalog - 目录索引。
 * @returns 当前版本；不属于 workspace 时返回空串。
 */
export function dependencyVersion(npmName: string, catalog: Catalog): string {
  return catalog.find(npmName)?.manifest.version ?? ""
}

/**
 * 按逻辑包名或目录标识查找发布候选。
 *
 * @param catalog - 目录索引。
 * @param identifier - 目标标识符。
 * @returns 命中的发布候选，或 undefined。
 */
export function findTarget(
  catalog: Catalog,
  identifier: string
): WorkspacePackage | undefined {
  return catalog.find(identifier, catalog.publishable())
}

/**
 * 判断目标标识是否可发布。
 *
 * @param catalog - 目录索引。
 * @param identifier - 目标标识符。
 * @returns 是否可发布。
 */
export function isKnownTarget(catalog: Catalog, identifier: string): boolean {
  return findTarget(catalog, identifier) !== undefined
}

/**
 * 列出可发布目标，供交互式树形选择使用。
 *
 * @param catalog - 目录索引。
 * @returns 分组结构。
 */
export function groupedOptions(catalog: Catalog): GroupChoice[] {
  const publishable = catalog.publishable()

  const groups: GroupChoice[] = []

  for (const scope of SCOPES) {
    const options = publishable
      .filter((item) => item.scope === scope)
      .map((item) => ({
        value: item.directory,
        label: `${item.name} · ${item.relativeDir}`,
      }))

    if (options.length > 0) {
      groups.push({ group: SCOPE_LABELS[scope] ?? scope, options })
    }
  }

  return groups
}

/**
 * 将 `all` 或逗号分隔的目标解析为依赖拓扑顺序的逻辑包名。
 *
 * @param catalog - 目录索引。
 * @param target - 原始目标参数。
 * @returns 拓扑顺序的逻辑包名列表。
 * @throws {WorkflowError} 目标为空或包含未知包时抛出。
 */
export function resolveTargets(catalog: Catalog, target: string): readonly string[] {
  const publishable = catalog.publishable()

  if (target === "") {
    throw usageError("发布目标不能为空。")
  }

  if (target === "all") {
    return orderByDependencies(publishable, (item) => dependenciesOf(item, catalog)).map(
      (item) => item.directory
    )
  }

  const selected = target.split(",").filter((item) => item !== "")

  if (selected.length === 0) {
    throw usageError("发布目标不能为空。")
  }

  const seen = new Set<string>()

  for (const identifier of selected) {
    if (!isKnownTarget(catalog, identifier) || seen.has(identifier)) {
      throw usageError(`无效发布目标：${target}`)
    }

    seen.add(identifier)
  }

  // 先按发现顺序筛选，再做拓扑排序，保证同一依赖层内的顺序可复现。
  const chosen = publishable.filter((item) => seen.has(item.directory))

  return orderByDependencies(chosen, (item) => dependenciesOf(item, catalog)).map(
    (item) => item.directory
  )
}
