/**
 * 项目工作流入口。
 *
 * @remarks 统一分派日常 workspace 任务、工具命令与发布流程。所有视觉输出走 stderr，
 * `release plan` 的计划路径等机器可读结果走 stdout。
 */
import { runDev } from "./workflow/commands/dev.ts"
import { fixUsage, runFix } from "./workflow/commands/fix.ts"
import { releaseUsage, runRelease } from "./workflow/commands/release.ts"
import { runTool, toolsUsage } from "./workflow/commands/tools.ts"
import { runWorkspaceTask, workspaceUsage } from "./workflow/commands/workspace.ts"
import { createContext } from "./workflow/core/context.ts"
import { usageError, WorkflowError } from "./workflow/core/errors.ts"
import { resolveRoot } from "./workflow/core/root.ts"
import { Ui } from "./workflow/ui/ui.ts"

import type { Context } from "./workflow/core/context.ts"

/** 走通用 workspace 批处理的任务。 */
const WORKSPACE_TASKS = new Set([
  "build",
  "build:analyze",
  "check",
  "lint",
  "lint:fix",
  "format",
  "format:check",
  "type-check",
  "type-check:tests",
  "test",
])

// 旧命令统一分派到主命令，保持现有调用可用。
const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  "code-check": "check",
  "release:test": "test:scripts",
}

// 项目脚本自检的进程定义。
interface SelfCheck {
  readonly title: string
  readonly command: string
  readonly args: readonly string[]
}

// 项目脚本自检不参与 workspace 目标选择。
const SELF_CHECKS: Readonly<Record<string, SelfCheck>> = {
  "type-check:scripts": {
    title: "检查项目脚本类型",
    command: "pnpm",
    args: ["exec", "tsc", "-p", "scripts/tsconfig.json", "--noEmit"],
  },
  "test:scripts": {
    title: "运行项目脚本测试",
    command: "pnpm",
    args: ["exec", "vitest", "run", "scripts"],
  },
}

/** 顶层工作流用法说明。 */
export function usage(): string {
  return [
    "用法：",
    "  pnpm workflow <command> [arguments]",
    "",
    "workspace command：dev、build、build:analyze、check、fix、lint、lint:fix、format、format:check、type-check、type-check:tests、test",
    "项目脚本自检：type-check:scripts、test:scripts",
    "tool command：preview、pack-local、check:packages",
    "release command：release <check|pack|publish|plan|dry-run|verify|execute> [...]",
    "兼容别名：code-check → check、release:test → test:scripts",
  ].join("\n")
}

/**
 * 分派一个工作流命令。
 *
 * @param context - 执行上下文。
 * @param args - 命令及参数。
 * @returns 退出码。
 * @throws {WorkflowError} 命令非法或参数错误时抛出。
 * @example
 * await dispatch(context, ["check", "core"])
 */
export async function dispatch(
  context: Context,
  args: readonly string[]
): Promise<number> {
  const requested = args[0] ?? ""

  const command = COMMAND_ALIASES[requested] ?? requested

  const rest = args.slice(1)

  // 帮助请求结束整个命令，不能继续执行附带的脚本自检。
  const help = rest.some((arg) => arg === "help" || arg === "-h" || arg === "--help")

  if (command === "" || command === "help" || command === "-h" || command === "--help") {
    context.ui.note(usage())

    return command === "" ? 2 : 0
  }

  if (command === "dev") {
    return await runDev(context, rest)
  }

  if (command === "fix") {
    return await runFix(context, rest)
  }

  if (command === "release") {
    return await runRelease(context, rest)
  }

  if (command === "preview" || command === "pack-local" || command === "check:packages") {
    return await runTool(context, command, rest)
  }

  if (WORKSPACE_TASKS.has(command)) {
    const exitCode = await runWorkspaceTask(context, command, rest)

    const selfCheck = SELF_CHECKS[`${command}:scripts`]

    if (exitCode !== 0 || help || !selfCheck) {
      return exitCode
    }

    return await runSelfCheck(context, selfCheck)
  }

  const selfCheck = SELF_CHECKS[command]

  if (selfCheck) {
    if (help) {
      context.ui.note(`用法：pnpm ${command}`)

      return 0
    }

    if (rest.length > 0) {
      throw usageError(`${command} 不接受目标或额外参数。`)
    }

    return await runSelfCheck(context, selfCheck)
  }

  throw usageError(`未知工作流命令：${command}`)
}

/**
 * 执行工作流自身的类型检查与测试。
 *
 * @param context - 执行上下文。
 * @param check - 检查定义。
 * @returns 退出码。
 */
async function runSelfCheck(context: Context, check: SelfCheck): Promise<number> {
  const { ui, root } = context

  ui.flowBegin({
    domain: "workspace",
    title: check.title,
    description: "覆盖项目脚本自身。",
  })
  const exitCode = await ui.task(
    { title: check.title, log: "live" },
    async () => await ui.exec(check.command, check.args, { cwd: root })
  )

  ui.flowEndFromExitCode(exitCode, {
    success: `${check.title}完成。`,
    failed: `${check.title}未通过。`,
    cancelled: `${check.title}已取消。`,
  })

  return exitCode
}

/**
 * 运行工作流入口。
 *
 * @param argv - 进程参数。
 * @returns 进程退出码。
 */
export async function main(argv: readonly string[]): Promise<number> {
  const ui = new Ui()

  const context = createContext(resolveRoot(), ui)

  try {
    return await dispatch(context, argv)
  } catch (error) {
    if (error instanceof WorkflowError) {
      // 用法错误额外打印帮助，便于直接定位。
      if (error.exitCode === 2) {
        ui.status("error", error.message)
        const requested = argv[0] ?? ""

        const command = COMMAND_ALIASES[requested] ?? requested

        if (command === "release") {
          ui.note(releaseUsage())
        } else if (command === "fix") {
          ui.note(fixUsage())
        } else if (
          command === "preview" ||
          command === "pack-local" ||
          command === "check:packages"
        ) {
          ui.note(toolsUsage())
        } else if (command === "dev" || WORKSPACE_TASKS.has(command)) {
          ui.note(workspaceUsage())
        } else {
          ui.note(usage())
        }

        return 2
      }

      if (error.exitCode === 130) {
        ui.status("info", "操作已取消。")

        return 0
      }

      ui.status("error", error.message)

      return error.exitCode
    }

    ui.status("error", error instanceof Error ? error.message : String(error))
    if (process.env.WORKFLOW_DEBUG === "true" && error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`)
    }

    return 1
  } finally {
    ui.cleanup()
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2))
}
