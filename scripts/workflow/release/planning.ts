/**
 * 发布计划创建。预发布序号在写入计划前从 registry 查询并固定下来。
 */
import { type Context } from "../core/context.ts"
import { failure, usageError } from "../core/errors.ts"

import * as git from "./adapters/git.ts"
import { nextPrereleaseSequence } from "./adapters/npm.ts"
import { type PlanDraft, type PlanPackage, writePlan } from "./plan.ts"
import { resolveTargets } from "./targets.ts"
import {
  baseline as computeBaseline,
  distTag,
  isAction,
  isChannel,
  isStable,
  needsSequence,
  releaseVersion,
  type VersionContext,
} from "./versions.ts"

/** 创建计划时可注入的外部输入。 */
export interface PlanContext extends VersionContext {
  /** 预发布序号；提供后跳过 registry 查询。 */
  readonly prereleaseSequence?: string
}

/**
 * 校验通道、目标与版本动作的组合。
 *
 * @param channel - 发布通道。
 * @param target - 发布目标。
 * @param versionAction - 版本动作或精确版本。
 * @throws {WorkflowError} 组合非法时抛出。
 */
function assertCombination(channel: string, target: string, versionAction: string): void {
  if (!isChannel(channel)) {
    throw usageError(`未知发布通道：${channel}`)
  }

  if (!isAction(versionAction)) {
    throw usageError(`无效版本动作：${versionAction}`)
  }

  if (channel !== "latest" && versionAction === "current") {
    throw usageError("预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。")
  }

  if (target.trim() === "") {
    throw usageError("发布目标不能为空。")
  }
}

/**
 * 解析一个包的预发布序号。
 *
 * @param context - 执行上下文。
 * @param packageName - npm 包名。
 * @param baselineVersion - 正式版本基线。
 * @param channel - 预发布通道。
 * @param planContext - 可注入的测试输入。
 * @returns 序号。
 * @throws {WorkflowError} 序号非法或 registry 查询失败时抛出。
 */
async function resolveSequence(
  context: Context,
  packageName: string,
  baselineVersion: string,
  channel: string,
  planContext: PlanContext
): Promise<number> {
  const injected = planContext.prereleaseSequence

  if (injected !== undefined) {
    if (!/^\d+$/.test(injected)) {
      throw usageError("SCHEMX_RELEASE_PRERELEASE_SEQUENCE 必须是非负整数。")
    }

    return Number(injected)
  }

  try {
    return await nextPrereleaseSequence(
      context.env,
      packageName,
      baselineVersion,
      channel
    )
  } catch {
    throw failure(`无法从 npm registry 查询 ${packageName} 的 ${channel} 预发布序号。`)
  }
}

/**
 * 创建冻结计划。
 *
 * @param context - 执行上下文。
 * @param channel - 发布通道。
 * @param target - 原始发布目标。
 * @param versionAction - 版本动作或精确版本。
 * @param planFile - 输出计划文件。
 * @param planContext - 可注入的测试输入。
 * @throws {WorkflowError} 校验失败或 registry 不可用时抛出。
 */
export async function createPlan(
  context: Context,
  channel: string,
  target: string,
  versionAction: string,
  planFile: string,
  planContext: PlanContext = {}
): Promise<void> {
  const { ui, catalog, env } = context

  assertCombination(channel, target, versionAction)

  const targets = resolveTargets(catalog, target)

  if (targets.length === 0) {
    // 原实现在这里把空记录数组展开给序列化器，在 bash 3.2 + set -u 下会直接致命退出。
    throw usageError("没有匹配到可发布的目标包。")
  }

  if (isStable(versionAction) && targets.length !== 1) {
    throw usageError("精确版本仅允许单包目标。")
  }

  const sourceSha = planContext.sha ?? env.SCHEMX_RELEASE_SHA ?? (await git.currentSha())

  const packages: PlanPackage[] = []

  for (const name of targets) {
    const item = catalog.find(name, catalog.publishable())

    if (!item?.manifest.version) {
      throw usageError(`无法读取发布包的当前版本：${name}`)
    }

    const currentVersion = item.manifest.version

    let baselineVersion: string

    try {
      baselineVersion = computeBaseline(currentVersion, versionAction)
    } catch {
      throw usageError(`无法根据 ${currentVersion} 计算 ${versionAction} 版本基线。`)
    }

    const sequence = needsSequence(channel)
      ? await resolveSequence(context, item.name, baselineVersion, channel, planContext)
      : 0

    const version = releaseVersion(channel, baselineVersion, sequence, {
      ...(planContext.sha === undefined ? {} : { sha: planContext.sha }),
      ...(planContext.timestamp === undefined
        ? {}
        : { timestamp: planContext.timestamp }),
    })

    packages.push({
      name: item.name,
      package: item.directory,
      currentVersion,
      baselineVersion,
      version,
      tag: `${item.name}@${version}`,
    })
  }

  const draft: PlanDraft = {
    channel,
    target,
    versionAction,
    distTag: distTag(channel),
    sourceSha,
    packages: packages.map(({ tag: _tag, ...rest }) => rest),
  }

  ui.note(`已冻结 ${packages.length} 个包的发布计划。`)
  writePlan(planFile, draft)
}
