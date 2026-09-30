/**
 * dev 命令：只选择定义 dev 或 dev:h5 的目标，并以持续运行方式启动开发服务。
 */
import { type Context } from "../core/context.ts"
import { CANCELLED_EXIT_CODE, usageError, WorkflowError } from "../core/errors.ts"
import { selectTaskTargets } from "../ui/target-selection.ts"

/** dev 命令的用法说明。 */
export function devUsage(): string {
  return [
    "用法：",
    "  pnpm workflow dev [target]",
    "",
    "target：examples/vant、examples/element-plus 或 examples/uniapp-vant；非交互环境必须显式提供",
  ].join("\n")
}

/**
 * 启动开发服务。
 *
 * @param context - 执行上下文。
 * @param args - 命令参数。
 * @returns 退出码。
 * @throws {WorkflowError} 参数非法或目标选择失败时抛出。
 */
export async function runDev(context: Context, args: readonly string[]): Promise<number> {
  const { ui, root } = context

  if (args.length > 1) {
    throw usageError(devUsage())
  }

  const requested = args[0] ?? ""

  if (requested === "-h" || requested === "--help" || requested === "help") {
    ui.note(devUsage())

    return 0
  }

  if (requested.startsWith("-")) {
    throw usageError(devUsage())
  }

  ui.flowBegin({
    domain: "workspace",
    title: "启动开发服务",
    description: "交互环境选择一个示例项目，持续运行其 dev 或 dev:h5 script。",
  })
  ui.note("开发服务器会持续占用当前终端；使用 Ctrl+C 停止。一次只能启动一个目标。")

  // 非交互环境必须显式指定单个目标，避免误启动全部示例。
  if (requested === "" && !ui.interactive) {
    ui.flowEnd("failed", "非交互环境启动 dev 时必须显式提供一个目标。")
    throw usageError("非交互环境启动 dev 时必须显式提供一个目标。")
  }

  let items

  try {
    items = await selectTaskTargets(ui, context.catalog, "dev", requested, "single")
  } catch (error) {
    const code = error instanceof WorkflowError ? error.exitCode : 1

    ui.flowEndFromExitCode(code, {
      success: "开发服务已结束：没有可用目标。",
      failed: "开发服务目标选择失败。",
      cancelled: "开发服务目标选择已取消。",
    })
    throw error
  }

  if (items.length === 0) {
    ui.status("warning", "没有目标定义 dev 或 dev:h5 script，无需启动。")
    ui.flowEnd("success", "开发服务已结束：没有可用目标。")

    return 0
  }

  if (items.length > 1) {
    ui.flowEnd("failed", "dev 仅支持一个目标，不支持 all 或多目标。")
    throw usageError("dev 仅支持一个目标，不支持 all 或多目标。")
  }

  const item = items[0]

  if (!item) {
    ui.flowEnd("success", "开发服务已结束：没有可用目标。")

    return 0
  }

  const exitCode = await ui.service(
    { title: `启动 ${item.name}`, itemKey: item.name, spin: false },
    "pnpm",
    ["--filter", item.name, "run", item.script],
    root
  )

  ui.flowEndFromExitCode(exitCode, {
    success: `开发服务已结束：${item.name}。`,
    failed: `开发服务失败：${item.name}。`,
    cancelled: "开发服务已取消。",
  })

  // Ctrl+C 结束长驻服务属于正常路径，与原实现一致地按成功返回。
  return exitCode === CANCELLED_EXIT_CODE ? 0 : exitCode
}
