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
import { type Context, createContext } from "./workflow/core/context.ts"
import { usageError, WorkflowError } from "./workflow/core/errors.ts"
import { run } from "./workflow/core/exec.ts"
import { resolveRoot } from "./workflow/core/root.ts"
import { Ui } from "./workflow/ui/ui.ts"

/** 走通用 workspace 批处理的任务。 */
const WORKSPACE_TASKS = new Set([
  "build",
  "build:analyze",
  "check",
  "code-check",
  "lint",
  "lint:fix",
  "format",
  "format:check",
  "type-check",
  "test",
])

/** 工作流自身的检查命令，不参与 workspace 批处理。 */
const SELF_CHECKS: Readonly<
  Record<
    string,
    { readonly title: string; readonly command: string; readonly args: readonly string[] }
  >
> = {
  "type-check:scripts": {
    title: "检查工作流脚本类型",
    command: "tsc",
    args: ["-p", "scripts/tsconfig.json", "--noEmit"],
  },
  "test:scripts": {
    title: "运行工作流脚本测试",
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
    "workspace command：dev、build、build:analyze、check、code-check、fix、lint、lint:fix、format、format:check、type-check、test",
    "workflow 自检：type-check:scripts、test:scripts",
    "tool command：preview、pack-local、check:packages",
    "release command：release <check|pack|publish|plan|dry-run|verify|execute> [...]",
  ].join("\n")
}

/**
 * 分派一个工作流命令。
 *
 * @param args - 命令及参数。
 * @returns 退出码。
 * @throws {WorkflowError} 命令非法或参数错误时抛出。
 */
async function dispatch(context: Context, args: readonly string[]): Promise<number> {
  const command = args[0] ?? ""

  if (command === "" || command === "help" || command === "-h" || command === "--help") {
    context.ui.note(usage())

    return command === "" ? 2 : 0
  }

  if (command === "dev") {
    return await runDev(context, args.slice(1))
  }

  if (command === "fix") {
    return await runFix(context, args.slice(1))
  }

  if (command === "release") {
    return await runRelease(context, args.slice(1))
  }

  if (command === "preview" || command === "pack-local" || command === "check:packages") {
    return await runTool(context, command, args.slice(1))
  }

  if (WORKSPACE_TASKS.has(command)) {
    return await runWorkspaceTask(context, command, args.slice(1))
  }

  const selfCheck = SELF_CHECKS[command]

  if (selfCheck) {
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
async function runSelfCheck(
  context: Context,
  check: {
    readonly title: string
    readonly command: string
    readonly args: readonly string[]
  }
): Promise<number> {
  const { ui, root } = context

  ui.flowBegin({
    domain: "workspace",
    title: check.title,
    description: "只覆盖工作流脚本自身。",
  })
  const exitCode = await ui.task(
    { title: check.title, log: "live" },
    async () => await run(check.command, check.args, { cwd: root })
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
        const command = argv[0] ?? ""

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

const exitCode = await main(process.argv.slice(2))

process.exitCode = exitCode
