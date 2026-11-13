/**
 * 质量检查范围与 workspace 依赖关系。
 */
import { existsSync } from "node:fs"
import path from "node:path"

import { usageError } from "../core/errors.ts"

import type { Catalog, SourceDirectory, WorkspacePackage } from "../core/catalog.ts"

/**
 * 已解析的检查目录及其构建依赖。
 */
export interface QualityScope {
  /**
   * 完整检查的源码目录。
   */
  readonly sources: readonly SourceDirectory[]
  /**
   * 完整检查的包。
   */
  readonly checked: readonly WorkspacePackage[]
  /**
   * 拓扑排列的构建包，包含只补构建的上游。
   */
  readonly builds: readonly WorkspacePackage[]
  /**
   * 包名到本地依赖名的映射。
   */
  readonly dependencies: ReadonlyMap<string, readonly string[]>
  /**
   * 是否检查工作流自身。
   */
  readonly scripts: boolean
}

/**
 * 解析目标及其递归下游，并补齐上游构建依赖。
 * @param catalog - 当前仓库的包及文件索引。
 * @param root - 仓库根目录。
 * @param requested - 目标简称、路径或包名，支持逗号分隔；默认全仓。
 * @example const scope = await resolveQualityScope(catalog, root, "vue")
 */
export async function resolveQualityScope(
  catalog: Catalog,
  root: string,
  requested = "all"
): Promise<QualityScope> {
  // 实际源码与 workspace 包互补，空包也必须校验脚本配置。
  const sources = await catalog.discoverSources()

  // 按目录稳定排序的 workspace 包。
  const packages = [...catalog.discover()].sort((left, right) =>
    left.relativeDir.localeCompare(right.relativeDir)
  )

  // 通过包名解析本地依赖的索引。
  const byName = new Map(packages.map((item) => [item.name, item]))

  // 当前仓库内的依赖边。
  const dependencies = new Map<string, readonly string[]>()

  for (const item of packages) {
    // 当前包的原始发布清单。
    const manifest = item.manifest

    // 该类包必须提供的脚本集合。
    const names = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    })

    dependencies.set(item.name, names.filter((name) => byName.has(name)).sort())
  }

  // 各目录可接受的目标别名。
  const directories = new Map<string, readonly string[]>()

  for (const item of [...sources, ...packages]) {
    directories.set(item.relativeDir, [item.relativeDir, item.directory, item.name])
  }

  // 完整检查目录的去重集合。
  const selected = new Set<string>()

  for (const token of requested.split(",")) {
    if (token === "all") {
      for (const directory of directories.keys()) {
        selected.add(directory)
      }

      continue
    }

    // 已有包简称优先指 packages；例如 vant 不与 examples/vant 冲突。
    const exact = [...directories].filter(
      ([directory, aliases]) => directory === token || aliases[2] === token
    )

    // packages 下优先匹配的包简称。
    const preferred = [...directories].filter(
      ([directory]) => directory === `packages/${token}`
    )

    // 当前标识符匹配的候选目录。
    let matches = [...directories].filter(([, aliases]) => aliases.includes(token))

    if (exact.length > 0) {
      matches = exact
    } else if (preferred.length > 0) {
      matches = preferred
    }

    if (matches.length !== 1) {
      throw usageError(
        `检查目标${matches.length === 0 ? "不存在" : "存在歧义"}：${token}`
      )
    }

    // 唯一匹配的目标目录。
    const match = matches[0]

    if (match) {
      selected.add(match[0])
    }
  }

  // 下游闭包只从显式检查包扩展，不能从补构建的上游扩展。
  let changed = true

  while (changed) {
    changed = false
    for (const item of packages) {
      if (
        !selected.has(item.relativeDir) &&
        dependencies
          .get(item.name)
          ?.some((name) => selected.has(byName.get(name)?.relativeDir ?? ""))
      ) {
        selected.add(item.relativeDir)
        changed = true
      }
    }
  }

  // 包含递归下游的完整检查包。
  const checked = packages.filter((item) => selected.has(item.relativeDir))

  // 按依赖顺序准备的构建任务。
  const builds: WorkspacePackage[] = []

  // 已完成拓扑排序的包。
  const done = new Set<string>()

  // 当前递归路径，用于报告循环。
  const visiting: string[] = []

  /**
   * @param item - 本次需要构建的包；递归加入其依赖并报告实际环路。
   */
  const visit = (item: WorkspacePackage): void => {
    if (done.has(item.name)) {
      return
    }

    // 当前包在递归路径中的首次出现位置。
    const cycle = visiting.indexOf(item.name)

    if (cycle >= 0) {
      throw usageError(
        `质量检查存在循环依赖：${[...visiting.slice(cycle), item.name].join(" → ")}`
      )
    }

    visiting.push(item.name)
    for (const name of dependencies.get(item.name) ?? []) {
      // 当前需要准备的本地依赖。
      const dependency = byName.get(name)

      if (dependency) {
        visit(dependency)
      }
    }

    visiting.pop()
    done.add(item.name)
    builds.push(item)
  }

  for (const item of checked) {
    visit(item)
  }

  // 映射 CLI 由仓库插件提供；无论何种包范围都先准备它。
  const plugin = byName.get("vite-plugin-workspace-source")

  if (plugin && (checked.length > 0 || selected.has("scripts") || requested === "all")) {
    visit(plugin)
  }

  // 当前范围是否包含工作流自检。
  const scripts =
    existsSync(path.join(root, "scripts/tsconfig.json")) &&
    (checked.length > 0 || selected.has("scripts") || requested === "all")

  if (scripts) {
    selected.add("scripts")
  }

  return {
    sources: sources.filter((item) => selected.has(item.relativeDir)),
    checked,
    builds,
    dependencies,
    scripts,
  }
}
