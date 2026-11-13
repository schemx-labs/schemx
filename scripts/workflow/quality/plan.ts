/**
 * 将检查范围编译为可去重、可阻断的任务图。
 */
import { isPublishable } from "../core/package-json.ts"
import { ESLINT_IGNORED_FILE_PATTERN, LINT_FILE_PATTERN } from "../target-selection.ts"

import type { QualityScope } from "./scope.ts"

/**
 * 单个任务的执行输入。
 */
export interface QualityTask {
  /**
   * 目录和任务种类组成的唯一标识。
   */
  readonly id: string
  /**
   * 目标目录。
   */
  readonly directory: string
  /**
   * 对使用者显示的任务名。
   */
  readonly title: string
  /**
   * 必须成功的前置任务。
   */
  readonly needs: readonly string[]
  /**
   * pnpm 参数；不存在时执行内置检查。
   */
  readonly args?: readonly string[]
  /**
   * 内置检查类型。
   */
  readonly check?: "config" | "artifacts"
  /**
   * 缺失脚本等配置错误。
   */
  readonly error?: string
  /**
   * 不适用的能力，单独列出且不计作通过。
   */
  readonly skip?: string
}

/**
 * 生成稳定顺序的质量任务；不运行命令。
 * @param scope - 已解析的完整检查及构建依赖范围。
 * @example const tasks = createQualityPlan(scope)
 */
export function createQualityPlan(scope: QualityScope): readonly QualityTask[] {
  // 按执行顺序保留的任务或结果。
  const tasks: QualityTask[] = []

  // 包名对应的唯一构建任务标识。
  const buildIds = new Map(
    scope.builds
      .filter((item) => item.manifest.scripts?.build)
      .map((item) => [item.name, `${item.relativeDir}:build`])
  )

  // 共享工具插件的构建前置。
  const pluginId = buildIds.get("vite-plugin-workspace-source")

  // 必须提供完整质量脚本的发布包目录。
  const required = new Set(
    scope.checked
      .filter((item) => item.scope === "packages" && isPublishable(item.manifest))
      .map((item) => item.relativeDir)
  )

  // 缺少必须能力在任何命令执行前即可发现。
  for (const item of scope.checked) {
    // 该类包必须提供的脚本集合。
    const names =
      item.scope === "examples"
        ? ["type-check", "build"]
        : ["lint", "format:check", "type-check", "test", "build"]

    if (!required.has(item.relativeDir) && item.scope !== "examples") {
      continue
    }

    // 清单尚未定义的必须脚本。
    const missing = names.filter((name) => !item.manifest.scripts?.[name])

    if (missing.length > 0) {
      tasks.push({
        id: `${item.relativeDir}:configuration`,
        directory: item.relativeDir,
        title: "检查任务配置",
        needs: [],
        error: `缺少必须脚本：${missing.join(", ")}`,
      })
    }
  }

  // 构建任务提前加入图中，静态检查后再由执行器按依赖调度。
  const builds: QualityTask[] = []

  for (const item of scope.builds) {
    const script = item.manifest.scripts?.["build:only"] ? "build:only" : "build"

    if (!item.manifest.scripts?.[script]) {
      continue
    }

    // 只等待本地依赖的构建，不把上游加入完整检查范围。
    const needs = (scope.dependencies.get(item.name) ?? []).flatMap(
      (name) => buildIds.get(name) ?? []
    )

    if (pluginId && item.name !== "vite-plugin-workspace-source") {
      needs.push(pluginId)
    }

    builds.push({
      id: `${item.relativeDir}:build`,
      directory: item.relativeDir,
      title: "build",
      needs,
      args: ["--dir", item.relativeDir, "run", script],
    })
  }

  for (const item of scope.sources) {
    // import/named 等规则会读取依赖声明，冷启动时 lint 也需要先准备上游产物。
    const owner = scope.checked.find(
      (candidate) => candidate.relativeDir === item.relativeDir
    )

    const lintNeeds = owner
      ? (scope.dependencies.get(owner.name) ?? []).flatMap(
          (name) => buildIds.get(name) ?? []
        )
      : []

    if (pluginId) lintNeeds.push(pluginId)
    // 需要 ESLint 检查的实际源码文件。
    const lint = item.files.filter(
      (file) => LINT_FILE_PATTERN.test(file) && !ESLINT_IGNORED_FILE_PATTERN.test(file)
    )

    // 需要 Prettier 检查的源码及配置文件。
    const format = item.files.filter((file) =>
      /\.(?:[cm]?[jt]sx?|vue|json|css|scss)$/.test(file)
    )

    if (lint.length > 0) {
      tasks.push({
        id: `${item.relativeDir}:lint`,
        directory: item.relativeDir,
        title: "lint",
        needs: [...new Set(lintNeeds)],
        args: ["exec", "eslint", "--", ...lint],
      })
    }

    if (format.length > 0) {
      tasks.push({
        id: `${item.relativeDir}:format`,
        directory: item.relativeDir,
        title: "format:check",
        needs: [],
        args: ["exec", "prettier", "--check", "--", ...format],
      })
    }
  }

  // 没有 package.json 的普通目录也明确报告其测试能力，scripts 有专用自检。
  for (const source of scope.sources) {
    if (
      source.relativeDir !== "scripts" &&
      !scope.checked.some((item) => item.relativeDir === source.relativeDir)
    ) {
      tasks.push({
        id: `${source.relativeDir}:test`,
        directory: source.relativeDir,
        title: "test",
        needs: [],
        skip: "未配置 test",
      })
    }
  }

  for (const item of scope.checked) {
    // 只等待本地依赖的构建，不把上游加入完整检查范围。
    const needs = (scope.dependencies.get(item.name) ?? []).flatMap(
      (name) => buildIds.get(name) ?? []
    )

    if (pluginId) {
      needs.push(pluginId)
    }

    if (item.name === "vite-plugin-workspace-source" && pluginId) {
      needs.push(pluginId)
    }

    for (const kind of ["type-check", "test"] as const) {
      let script: string = kind

      if (kind === "test" && item.manifest.scripts?.["test:only"]) {
        script = "test:only"
      }

      const task = {
        id: `${item.relativeDir}:${kind}`,
        directory: item.relativeDir,
        title: kind,
        needs: [...new Set(needs)],
      }

      if (item.manifest.scripts?.[script]) {
        tasks.push({ ...task, args: ["--dir", item.relativeDir, "run", script] })
      } else {
        tasks.push({ ...task, skip: `未配置 ${kind}` })
      }
    }

    if (item.scope === "packages" && isPublishable(item.manifest)) {
      tasks.push({
        id: `${item.relativeDir}:config`,
        directory: item.relativeDir,
        title: "检查包配置",
        needs: [],
        check: "config",
      })
      tasks.push({
        id: `${item.relativeDir}:artifacts`,
        directory: item.relativeDir,
        title: "检查发布产物",
        needs: buildIds.get(item.name) ? [String(buildIds.get(item.name))] : [],
        check: "artifacts",
      })
    }
  }

  if (scope.scripts) {
    // 本任务需要成功完成的构建前置。
    const needs = pluginId ? [pluginId] : []

    tasks.push({
      id: "scripts:type-check",
      directory: "scripts",
      title: "检查项目脚本类型",
      needs,
      args: ["exec", "tsc", "-p", "scripts/tsconfig.json", "--noEmit"],
    })
    tasks.push({
      id: "scripts:test",
      directory: "scripts",
      title: "运行项目脚本测试",
      needs,
      args: ["exec", "vp", "test", "run", "scripts"],
    })
  }

  // 任务顺序优先静态/测试，再构建；执行器遇到构建前置时递归准备。
  const artifacts = tasks.filter((task) => task.check === "artifacts")

  // 缺失必须脚本的目录配置任务。
  const configurationIds = new Set(
    tasks.filter((task) => task.error).map((task) => task.id)
  )

  return [
    ...tasks.filter((task) => task.check !== "artifacts"),
    ...builds,
    ...artifacts,
  ].map((task) => {
    // 当前目录的配置前置标识。
    const configurationId = `${task.directory}:configuration`

    if (task.id !== configurationId && configurationIds.has(configurationId)) {
      return { ...task, needs: [...task.needs, configurationId] }
    }

    return task
  })
}
