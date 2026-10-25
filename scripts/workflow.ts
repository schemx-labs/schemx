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
import {
  endWorkflowFlow,
  formatWorkflowText,
  runWorkflowCommand,
} from "./workflow/presentation.ts"
import { createTerminal } from "./workflow/ui/index.ts"

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
    args: ["exec", "vp", "test", "run", "scripts"],
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
  const command = args[0] ?? ""

  const rest = args.slice(1)

  // 帮助请求结束整个命令，不能继续执行附带的脚本自检。
  const help = rest.some((arg) => arg === "help" || arg === "-h" || arg === "--help")

  if (command === "" || command === "help" || command === "-h" || command === "--help") {
    context.terminal.text({
      content: formatWorkflowText({ terminal: context.terminal, content: usage() }),
    })

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
      context.terminal.text({
        content: formatWorkflowText({
          terminal: context.terminal,
          content: `用法：pnpm ${command}`,
        }),
      })

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
  const { terminal, root } = context

  const flowId1 = terminal.startFlow({
    domain: "workspace",
    title: check.title,
    description: formatWorkflowText({ terminal, content: "覆盖项目脚本自身。" }),
  })

  const exitCode = await runWorkflowCommand({
    terminal: terminal,
    title: check.title,
    command: check.command,
    args: check.args,
    cwd: root,
    parentId: flowId1,
  })

  endWorkflowFlow({
    terminal: terminal,
    flowId: flowId1,
    exitCode: exitCode,
    messages: {
      success: `${check.title}完成。`,
      failed: `${check.title}未通过。`,
      cancelled: `${check.title}已取消。`,
    },
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
  const terminal = createTerminal({ cwd: resolveRoot() })

  const context = createContext(resolveRoot(), terminal)

  try {
    return await dispatch(context, argv)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      terminal.info({ message: "操作已取消。" })

      return 0
    }

    if (error instanceof WorkflowError) {
      // 用法错误额外打印帮助，便于直接定位。
      if (error.exitCode === 2) {
        terminal.status({ tone: "error", message: error.message })
        const command = argv[0] ?? ""

        if (command === "release") {
          terminal.text({
            content: formatWorkflowText({ terminal: terminal, content: releaseUsage() }),
          })
        } else if (command === "fix") {
          terminal.text({
            content: formatWorkflowText({ terminal: terminal, content: fixUsage() }),
          })
        } else if (
          command === "preview" ||
          command === "pack-local" ||
          command === "check:packages"
        ) {
          terminal.text({
            content: formatWorkflowText({ terminal: terminal, content: toolsUsage() }),
          })
        } else if (command === "dev" || WORKSPACE_TASKS.has(command)) {
          terminal.text({
            content: formatWorkflowText({
              terminal: terminal,
              content: workspaceUsage(),
            }),
          })
        } else {
          terminal.text({
            content: formatWorkflowText({ terminal: terminal, content: usage() }),
          })
        }

        return 2
      }

      if (error.exitCode === 130) {
        terminal.status({ tone: "info", message: "操作已取消。" })

        return 0
      }

      terminal.status({ tone: "error", message: error.message })

      return error.exitCode
    }

    terminal.status({
      tone: "error",
      message: error instanceof Error ? error.message : String(error),
    })
    if (process.env.WORKFLOW_DEBUG === "true" && error instanceof Error && error.stack) {
      terminal.text({
        content: formatWorkflowText({ terminal: terminal, content: error.stack }),
      })
    }

    return 1
  } finally {
    terminal.dispose()
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2))
}
