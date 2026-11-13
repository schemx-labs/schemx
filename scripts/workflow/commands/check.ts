/** 完整质量检查命令；不依赖发布计划或凭据。 */
import { endWorkflowFlow } from "../presentation.ts"
import { createQualityPlan } from "../quality/plan.ts"
import { runQualityPlan } from "../quality/run.ts"
import { resolveQualityScope } from "../quality/scope.ts"
import { parseBatchArguments } from "../target-selection.ts"

import type { Context } from "../core/context.ts"

/**
 * 默认检查全仓，显式目标自动覆盖下游。
 * @param context - 仓库及终端上下文。
 * @param args - 可选目标与 --keep-going。
 * @example await runCheck(context, ["vue", "--keep-going"])
 */
export async function runCheck(
  context: Context,
  args: readonly string[]
): Promise<number> {
  const parsed = parseBatchArguments(args)

  if (parsed.help) {
    context.terminal.text({
      content:
        "用法：pnpm check [all|目标[,目标...]] [--keep-going]\n默认全仓；显式目标包含递归下游。执行静态检查、类型、测试、构建和发布产物检查。",
    })

    return 0
  }

  const scope = await resolveQualityScope(
    context.catalog,
    context.root,
    parsed.target || "all"
  )

  const plan = createQualityPlan(scope)

  const flowId = context.terminal.startFlow({
    domain: "workspace",
    title: "完整质量检查",
    description: "检查所选目标及下游，并补齐构建依赖；不执行发布操作。",
  })

  const result = await runQualityPlan({ ...context, parentId: flowId }, plan, {
    keepGoing: parsed.keepGoing,
  })

  endWorkflowFlow({
    terminal: context.terminal,
    flowId,
    exitCode: result.code,
    messages: {
      success: "完整质量检查通过。",
      failed: "完整质量检查失败。",
      cancelled: "完整质量检查已取消。",
    },
  })

  return result.code
}
