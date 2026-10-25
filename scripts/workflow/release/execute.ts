/**
 * release execute 编排：只消费冻结计划，负责版本写入、发布、标记与恢复边界。
 *
 * @remarks 发布过程中的不可逆步骤按包记录在发布进度文件中，中断后可以续跑。
 */
import { existsSync } from "node:fs"

import { type Context } from "../core/context.ts"
import { formatWorkflowText } from "../presentation.ts"
import { workflowExitCode, workflowRunner } from "../presentation.ts"
import { runWorkflowTask } from "../presentation.ts"

import * as git from "./adapters/git.ts"
import { renderOutcome, renderPlan } from "./feedback.ts"
import { confirmExecution } from "./inputs.ts"
import {
  commitPublishedVersions,
  createMarkers,
  publishPackages,
  verifyPlan,
} from "./operations.ts"
import { readPlan, type ReleasePlan } from "./plan.ts"
import { assertMatchesPlan, hasStep, publishedNames, statePath } from "./state.ts"
import { VersionBackup } from "./version-backup.ts"

/**
 * 决定是否需要在发布前写入目标版本。
 *
 * @param plan - 冻结计划。
 * @returns 是否写入版本。
 */
function needsVersionWrite(plan: ReleasePlan): boolean {
  return plan.channel !== "latest" || plan.versionAction !== "current"
}

/**
 * 收尾版本改动。
 *
 * @remarks 正式版只回滚尚未发布的包，已发布包的版本改动必须保留，才能与 npm 上的
 * 版本保持一致并进入版本提交；预发布通道不提交版本，工作区必须恢复干净。
 *
 * 状态文件损坏时不做任何猜测：保留备份并中止，交由使用者处理。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @param backup - 版本备份；为空表示本次未改写版本。
 * @throws {Error} 状态不可用导致无法安全回滚时抛出。
 */
function finalizeVersions(
  context: Context,
  plan: ReleasePlan,
  planFile: string,
  backup: VersionBackup | undefined
): void {
  if (!backup?.active) {
    return
  }

  if (plan.channel !== "latest") {
    backup.restoreAll()
    backup.discard()

    return
  }

  try {
    backup.restoreExcept(publishedNames(plan, planFile))
    backup.discard()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    context.terminal.status({
      tone: "error",
      message: `发布进度不可用（${reason}）；已保留版本备份且未执行任何回滚：${backup.directory}`,
    })
    throw error
  }
}

/**
 * 执行一次冻结计划的发布步骤。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @returns 退出码。
 */
async function executeSteps(
  context: Context,
  plan: ReleasePlan,
  planFile: string
): Promise<number> {
  const { terminal, catalog } = context

  // 预发布续跑只补标记时无需改写版本；正式版仍保留版本提交所需的恢复逻辑。
  const writeVersion =
    needsVersionWrite(plan) &&
    (plan.channel === "latest" ||
      plan.packages.some((item) => !hasStep(planFile, item.package, "published")))

  const backup = writeVersion ? VersionBackup.create(catalog, plan.packages) : undefined

  let tagTarget = plan.sourceSha

  let followUp = 0

  let publish = 0

  const groupId1 = terminal.startGroup({
    title: "执行发布",
    description: formatWorkflowText({
      terminal,
      content:
        "以下步骤将依次执行 npm 发布、Git Tag 与 GitHub Release；发布成功的包无法自动撤回，进度会逐包记录以便续跑。",
    }),
    parentId: context.parentId,
  })

  try {
    publish = await publishPackages(
      { ...context, parentId: groupId1 },
      plan,
      planFile,
      writeVersion
    )

    // 部分成功也要把已发布的版本写入版本库，并补齐它们的 Tag 与 Release。
    if (plan.createCommit) {
      followUp = await commitPublishedVersions(
        { ...context, parentId: groupId1 },
        plan,
        planFile,
        "chore(发布): 更新正式版本"
      )
      // 版本提交已包含已发布的版本，推送与标记都以该提交为准，保证 npm 与版本库一致。
      if (
        followUp === 0 &&
        plan.packages.some((item) => hasStep(planFile, item.package, "published"))
      ) {
        const pushCode = await runWorkflowTask({
          terminal: terminal,
          title: "推送正式版提交",
          parentId: groupId1,
          execute: async () => await git.pushReleaseCommit(workflowRunner({ terminal })),
        })

        if (pushCode !== 0) {
          followUp = pushCode
        } else {
          tagTarget = "HEAD"
        }
      }
    }

    if (followUp === 0 && plan.createTag) {
      followUp = await createMarkers(
        { ...context, parentId: groupId1 },
        plan,
        planFile,
        tagTarget
      )
    }
  } catch (error) {
    // 步骤本身抛出（例如状态文件损坏）时不猜测回滚范围。
    terminal.endGroup({
      groupId: groupId1,
      outcome: "failed",
      message: "发布步骤执行失败。",
    })

    return workflowExitCode(error)
  }

  finalizeVersions(context, plan, planFile, backup)

  if (followUp !== 0) {
    terminal.endGroup({
      groupId: groupId1,
      outcome: "failed",
      message: "已发布包的版本提交或标记步骤失败。",
    })

    return followUp
  }

  if (publish !== 0) {
    terminal.endGroup({
      groupId: groupId1,
      outcome: "failed",
      message: "发布中断：已完成的步骤可在续跑时跳过。",
    })

    return publish
  }

  renderOutcome(terminal, plan, planFile)
  terminal.endGroup({
    groupId: groupId1,
    outcome: "success",
    message: "发布步骤执行完成。",
  })

  return 0
}

/**
 * 执行已经确认和验证的冻结计划。
 *
 * @param context - 执行上下文。
 * @param planFile - 计划文件路径。
 * @returns 退出码。
 */
export async function executePlan(context: Context, planFile: string): Promise<number> {
  const { terminal } = context

  const plan = readPlan(planFile)

  try {
    assertMatchesPlan(plan, planFile)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    terminal.status({
      tone: "error",
      message: `${reason}；请删除 ${statePath(planFile)} 后重新发布。`,
      parentId: context.parentId,
    })

    return 2
  }

  renderPlan(terminal, plan)
  if (existsSync(statePath(planFile))) {
    terminal.status({
      tone: "warning",
      message: "检测到未完成的发布进度，本次执行会跳过已完成的步骤。",
      parentId: context.parentId,
    })
  }

  if (!(await confirmExecution(context))) {
    terminal.status({
      tone: "warning",
      message: "已取消发布；冻结计划与发布进度未被修改。",
      parentId: context.parentId,
    })

    return 130
  }

  const verifyCode = await verifyPlan(context, plan, planFile, false)

  if (verifyCode !== 0) {
    return verifyCode
  }

  try {
    return await executeSteps(context, plan, planFile)
  } catch (error) {
    terminal.status({
      tone: "error",
      message: error instanceof Error ? error.message : String(error),
      parentId: context.parentId,
    })

    return workflowExitCode(error)
  }
}
