/**
 * workspace 批处理命令。
 *
 * @remarks `build` 与 `lint`/`test` 等任务在原实现里是两套几乎逐字相同的脚本
 * （`commands/build.sh` 与 `commands/workspace.sh` 的执行规则完全一致，只有 usage
 * 文案不同），这里合并为一个入口，任务名即分支。
 */
import { type Context } from "../core/context.ts"
import { WorkflowError } from "../core/errors.ts"
import { runBatchFlow } from "../ui/batch.ts"
import {
  parseBatchArguments,
  selectTaskTargets,
  taskLabel,
  type TaskTarget,
} from "../ui/target-selection.ts"
import { type Ui } from "../ui/ui.ts"

/** 批处理任务的用法说明。 */
export function workspaceUsage(): string {
  return [
    "用法：",
    "  pnpm workflow <task> [target] [--keep-going]",
    "",
    "task：build、build:analyze、check、code-check、lint、lint:fix、format、format:check、type-check、test",
    "target：all、packages/core、plugins/<name>、examples/<name>，或以英文逗号分隔的多个目标",
  ].join("\n")
}

/**
 * 在一个 workspace 目录中执行任务。
 *
 * @param ui - 终端 UI。
 * @param root - 仓库根目录。
 * @param item - 目标。
 * @param index - 当前序号。
 * @param total - 总数。
 * @returns 退出码。
 */
async function runTarget(
  ui: Ui,
  root: string,
  item: TaskTarget,
  index: number,
  total: number
): Promise<number> {
  return await ui.task(
    { title: item.script, itemKey: item.name, last: index === total },
    async () =>
      await ui.exec("pnpm", ["--dir", item.relativeDir, "run", item.script], {
        cwd: root,
      })
  )
}

/**
 * 执行一个批处理任务。
 *
 * @param context - 执行上下文。
 * @param task - 任务名，对应各包的同名 npm script。
 * @param args - 命令参数。
 * @returns 退出码。
 */
export async function runWorkspaceTask(
  context: Context,
  task: string,
  args: readonly string[]
): Promise<number> {
  const { ui, catalog, root } = context

  const label = taskLabel(task)

  let target = ""

  let keepGoing = false

  try {
    const parsed = parseBatchArguments(args)

    if (parsed.help) {
      ui.note(workspaceUsage())

      return 0
    }

    target = parsed.target
    keepGoing = parsed.keepGoing
  } catch (error) {
    ui.status("error", error instanceof Error ? error.message : String(error))
    ui.note(workspaceUsage())

    return 2
  }

  let items: readonly TaskTarget[]

  try {
    items = await selectTaskTargets(ui, catalog, task, target)
  } catch (error) {
    const code = error instanceof WorkflowError ? error.exitCode : 1

    ui.flowEndFromExitCode(code, {
      success: `${label}完成。`,
      failed: `${label}目标选择失败。`,
      cancelled: `${label}目标选择已取消。`,
    })
    throw error
  }

  if (items.length === 0) {
    ui.flowBegin({
      domain: "workspace",
      title: label,
      description: "按选中 workspace 目标逐个执行对应 script。",
    })
    ui.status("warning", `没有目标定义 ${task} script，无需执行。`)
    ui.flowEnd("success", `${label}完成：没有可用目标。`)

    return 0
  }

  return await runBatchFlow(ui, {
    label,
    items,
    keepGoing,
    identify: (item) => item.name,
    taskLabel: label,
    execute: async (item, index, total) => await runTarget(ui, root, item, index, total),
  })
}
