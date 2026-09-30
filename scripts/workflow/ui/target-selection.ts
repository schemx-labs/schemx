/**
 * workspace 目标发现与选择。
 *
 * @remarks 原实现用 `group:::<id>:::<label>` 字符串协议在 Shell 与交互控件之间传递分组信息，
 * 并把记录编码成 TSV 在管道中往返；这里直接传递结构化对象。
 */
import {
  type Catalog,
  scopeLabel,
  WORKSPACE_SCOPES,
  type WorkspacePackage,
} from "../core/catalog.ts"
import { cancelled, usageError } from "../core/errors.ts"
import { hasScript, type PackageManifest } from "../core/package-json.ts"

import { type GroupChoice, groupMultiselect, select } from "./prompt.ts"
import { type Ui } from "./ui.ts"

/** 任务到候选 npm script 的映射。 */
const TASK_SCRIPTS: Readonly<Record<string, readonly string[]>> = {
  build: ["build", "build:h5"],
  dev: ["dev", "dev:h5"],
  "code-check": ["check"],
}

/** 一个可执行的任务目标。 */
export interface TaskTarget {
  /** 所属目录层级。 */
  readonly scope: string
  /** 目录名。 */
  readonly directory: string
  /** 相对仓库根的目录。 */
  readonly relativeDir: string
  /** npm 包名。 */
  readonly name: string
  /** 实际要执行的 npm script。 */
  readonly script: string
}

/** 目标选择模式。 */
export type SelectionMode = "multi" | "single"

/** 目标选择选项。 */
export interface TargetSelectionOptions {
  /** 选择控件标题。 */
  readonly title: string
  /** 候选项。 */
  readonly candidates: readonly TaskTarget[]
  /** 命令行显式指定的目标。 */
  readonly requested?: string
  /** 单选或多选。 */
  readonly mode?: SelectionMode
  /** 非交互环境下的默认选择。 */
  readonly nonInteractiveDefault?: string
}

/** 批处理参数解析结果。 */
export interface BatchArguments {
  /** 显式目标；未提供时为空串。 */
  readonly target: string
  /** 是否在失败后继续。 */
  readonly keepGoing: boolean
  /** 是否请求帮助。 */
  readonly help: boolean
}

/**
 * 解析 workspace 有限任务共用的 `--target` 与 `--keep-going`。
 *
 * @param args - 命令参数。
 * @returns 解析结果。
 * @throws {WorkflowError} 出现未知选项或多个目标时抛出。
 */
export function parseBatchArguments(args: readonly string[]): BatchArguments {
  let target = ""

  let keepGoing = false

  let help = false

  for (const argument of args) {
    if (argument === "--keep-going") {
      keepGoing = true
    } else if (argument === "-h" || argument === "--help" || argument === "help") {
      help = true
    } else if (argument.startsWith("-")) {
      throw usageError(`未知 workspace 选项：${argument}`)
    } else if (target === "") {
      target = argument
    } else {
      throw usageError("workspace 有限任务最多接受一个 target。")
    }
  }

  return { target, keepGoing, help }
}

/**
 * 发现定义了指定任务 script 的 workspace 包。
 *
 * @param catalog - 目录索引。
 * @param task - 任务名。
 * @returns 任务目标列表。
 */
export function discoverTaskTargets(
  catalog: Catalog,
  task: string
): readonly TaskTarget[] {
  const candidates = TASK_SCRIPTS[task] ?? [task]

  return catalog
    .discover(WORKSPACE_SCOPES)
    .flatMap((item: WorkspacePackage): TaskTarget[] => {
      for (const script of candidates) {
        if (hasScript(item.manifest, script)) {
          return [
            {
              scope: item.scope,
              directory: item.directory,
              relativeDir: item.relativeDir,
              name: item.name,
              script,
            },
          ]
        }
      }

      return []
    })
}

/**
 * 把一组候选项转换为分组多选结构。
 *
 * @param candidates - 候选项。
 * @returns 分组结构。
 */
function toGroups(candidates: readonly TaskTarget[]): GroupChoice[] {
  const groups: GroupChoice[] = []

  for (const scope of WORKSPACE_SCOPES) {
    const options = candidates
      .filter((item) => item.scope === scope)
      .map((item) => ({ value: item.relativeDir, label: item.relativeDir }))

    if (options.length > 0) {
      groups.push({ group: scopeLabel(scope), options })
    }
  }

  return groups
}

/**
 * 解析目标来源优先级：命令行 → 环境变量 → 非交互默认 → 交互控件。
 *
 * @param requested - 命令行目标。
 * @param env - 环境变量。
 * @returns 逗号分隔的目标串；未解析时为空串。
 */
function resolveRequested(requested: string, env: NodeJS.ProcessEnv): string {
  return requested || env.SCHEMX_WORKFLOW_TARGETS || env.SCHEMX_WORKFLOW_TARGET || ""
}

/**
 * 选择一个或多个目标标识符。
 *
 * @param ui - 终端 UI。
 * @param options - 选择选项。
 * @returns 逗号分隔的目标串。
 * @throws {WorkflowError} 用户取消、单选模式收到多值或未选任何目标时抛出。
 */
export async function selectTargetIdentifiers(
  ui: Ui,
  options: TargetSelectionOptions
): Promise<string> {
  const mode = options.mode ?? "multi"

  const selected = resolveRequested(options.requested ?? "", ui.env)

  if (selected !== "") {
    if (mode === "single" && selected.includes(",")) {
      throw usageError("当前流程仅支持选择一个目标。")
    }

    return selected
  }

  if (!ui.interactive) {
    return options.nonInteractiveDefault ?? "all"
  }

  if (options.candidates.length === 0) {
    return ""
  }

  if (mode === "single") {
    return await select(
      options.title,
      options.candidates.map((item) => ({
        value: item.relativeDir,
        label: item.relativeDir,
      }))
    )
  }

  const values = await groupMultiselect(options.title, toGroups(options.candidates))

  if (values.length === 0) {
    throw usageError("请至少选择一个目标后再继续。")
  }

  return values.join(",")
}

/**
 * 选择并筛选任务目标。
 *
 * @param ui - 终端 UI。
 * @param catalog - 目录索引。
 * @param task - 任务名。
 * @param requested - 命令行目标。
 * @param mode - 单选或多选。
 * @returns 命中的任务目标列表。
 * @throws {WorkflowError} 用户取消或单选模式收到多值时抛出。
 */
export async function selectTaskTargets(
  ui: Ui,
  catalog: Catalog,
  task: string,
  requested: string,
  mode: SelectionMode = "multi"
): Promise<readonly TaskTarget[]> {
  const candidates = discoverTaskTargets(catalog, task)

  if (candidates.length === 0) {
    return []
  }

  const selected = await selectTargetIdentifiers(ui, {
    title: `请选择 ${taskLabel(task)} 的目标`,
    candidates,
    requested,
    mode,
  })

  if (selected === "" || selected === "all") {
    return candidates
  }

  if (mode === "single" && selected.includes(",")) {
    throw cancelled("当前流程仅支持选择一个目标。")
  }

  // 精确匹配三种可接受的标识形式，避免目录名互为前缀时误命中。
  const wanted = new Set(selected.split(",").filter((item) => item !== ""))

  return candidates.filter(
    (item) =>
      wanted.has(item.relativeDir) || wanted.has(item.directory) || wanted.has(item.name)
  )
}

/**
 * 判断包清单是否具备任一候选 script。
 *
 * @param manifest - 包清单。
 * @param scripts - 候选 script 列表。
 * @returns 是否具备。
 */
export function manifestHasAnyScript(
  manifest: PackageManifest,
  scripts: readonly string[]
): boolean {
  return scripts.some((script) => hasScript(manifest, script))
}

/**
 * 返回任务的中文显示名。
 *
 * @param task - 任务名。
 * @returns 显示名。
 */
export function taskLabel(task: string): string {
  const labels: Readonly<Record<string, string>> = {
    dev: "启动开发服务",
    build: "构建",
    "build:analyze": "构建分析",
    check: "完整检查",
    "code-check": "代码检查",
    lint: "检查 lint",
    "lint:fix": "修复 lint",
    format: "格式化",
    "format:check": "检查格式",
    "type-check": "类型检查",
    test: "测试",
  }

  return labels[task] ?? `执行 ${task}`
}
