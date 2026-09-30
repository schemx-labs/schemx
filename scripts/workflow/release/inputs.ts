/**
 * 发布输入适配器。在 CLI、环境变量与交互控件之间取得一个有效值。
 */
import { type Catalog } from "../core/catalog.ts"
import { usageError } from "../core/errors.ts"
import { confirm, groupMultiselect, select, text } from "../ui/prompt.ts"
import { type Ui } from "../ui/ui.ts"

import { groupedOptions, resolveTargets } from "./targets.ts"
import { isAction, isChannel, isStable } from "./versions.ts"

/** 发布通道的展示文案。 */
const CHANNEL_CHOICES: readonly { value: string; label: string }[] = [
  { value: "dev", label: "dev · 开发测试发布" },
  { value: "alpha", label: "alpha · 早期实验与分支验证" },
  { value: "beta", label: "beta · 面向公开测试" },
  { value: "rc", label: "rc · 正式版候选验证" },
  { value: "next", label: "next · 下一版本预览" },
  { value: "latest", label: "latest · 正式稳定发布（仅 main）" },
]

/** latest 通道的版本动作选项。 */
const LATEST_ACTION_CHOICES: readonly { value: string; label: string }[] = [
  { value: "current", label: "current · 使用当前正式版本" },
  { value: "patch", label: "patch · 提升补丁版本" },
  { value: "minor", label: "minor · 提升次版本" },
  { value: "major", label: "major · 提升主版本" },
  { value: "custom", label: "custom · 指定 x.y.z 版本" },
]

/** 预发布通道的版本动作选项。 */
const PRERELEASE_ACTION_CHOICES: readonly { value: string; label: string }[] = [
  { value: "patch", label: "patch · 下一补丁版本线" },
  { value: "minor", label: "minor · 下一次版本线" },
  { value: "major", label: "major · 下一主版本线" },
  { value: "custom", label: "custom · 指定 x.y.z 版本线" },
]

/**
 * 选择或验证发布通道。
 *
 * @param ui - 终端 UI。
 * @param requested - 命令行指定的通道。
 * @returns 发布通道。
 * @throws {WorkflowError} 通道非法、非交互环境未指定或用户取消时抛出。
 */
export async function selectChannel(ui: Ui, requested: string): Promise<string> {
  const channel = requested || ui.env.SCHEMX_RELEASE_CHANNEL || ""

  if (channel === "") {
    if (!ui.interactive) {
      throw usageError("非交互环境必须通过参数或 SCHEMX_RELEASE_CHANNEL 指定发布通道。")
    }

    return await select("发布通道", CHANNEL_CHOICES)
  }

  if (!isChannel(channel)) {
    throw usageError(`未知发布通道：${channel}`)
  }

  return channel
}

/**
 * 选择一个或多个发布目标，并统一转换为稳定的逗号分隔参数。
 *
 * @param ui - 终端 UI。
 * @param catalog - 目录索引。
 * @param requested - 命令行指定的目标。
 * @returns 逗号分隔的逻辑包名。
 * @throws {WorkflowError} 目标非法、非交互环境未指定或用户取消时抛出。
 */
export async function selectTarget(
  ui: Ui,
  catalog: Catalog,
  requested: string
): Promise<string> {
  let target = requested || ui.env.SCHEMX_RELEASE_TARGET || ""

  if (target === "") {
    if (!ui.interactive) {
      throw usageError("非交互环境必须通过参数或 SCHEMX_RELEASE_TARGET 指定发布目标。")
    }

    const selected = await groupMultiselect("发布目标（可多选）", groupedOptions(catalog))

    target = selected.join(",")
  }

  return resolveTargets(catalog, target).join(",")
}

/**
 * 选择精确的正式版本基线。
 *
 * @param ui - 终端 UI。
 * @param requested - 命令行指定的版本。
 * @returns 精确版本。
 * @throws {WorkflowError} 格式非法、非交互环境未指定或用户取消时抛出。
 */
export async function selectExactVersion(ui: Ui, requested: string): Promise<string> {
  const version = requested || ui.env.SCHEMX_RELEASE_CUSTOM_VERSION || ""

  if (version === "") {
    if (!ui.interactive) {
      throw usageError(
        "非交互环境必须通过参数或 SCHEMX_RELEASE_CUSTOM_VERSION 指定版本基线。"
      )
    }

    const entered = await text("输入发布版本基线", "例如 1.0.0")

    if (!isStable(entered)) {
      throw usageError("版本基线必须是 x.y.z 格式。")
    }

    return entered
  }

  if (!isStable(version)) {
    throw usageError("版本基线必须是 x.y.z 格式。")
  }

  return version
}

/**
 * 按通道选择或验证版本动作。
 *
 * @param ui - 终端 UI。
 * @param channel - 发布通道。
 * @param requested - 命令行指定的版本动作。
 * @returns 版本动作或精确版本。
 * @throws {WorkflowError} 动作非法、非交互环境未指定或用户取消时抛出。
 */
export async function selectVersionAction(
  ui: Ui,
  channel: string,
  requested: string
): Promise<string> {
  const action = requested || ui.env.SCHEMX_RELEASE_VERSION_ACTION || ""

  if (action === "") {
    if (!ui.interactive) {
      throw usageError(
        "非交互环境必须通过参数或 SCHEMX_RELEASE_VERSION_ACTION 指定版本动作。"
      )
    }

    return await resolveVersionAction(
      ui,
      channel,
      await select(
        channel === "latest" ? "版本动作" : "版本基线动作",
        channel === "latest" ? LATEST_ACTION_CHOICES : PRERELEASE_ACTION_CHOICES
      )
    )
  }

  return await resolveVersionAction(ui, channel, action)
}

/**
 * 归一化版本动作，将 custom 转换为精确版本基线。
 *
 * @param ui - 终端 UI。
 * @param channel - 发布通道。
 * @param action - 版本动作、custom 或精确版本。
 * @returns 版本动作或精确版本。
 * @throws {WorkflowError} 动作非法或用户取消时抛出。
 */
async function resolveVersionAction(
  ui: Ui,
  channel: string,
  action: string
): Promise<string> {
  if (action === "custom") {
    return await selectExactVersion(ui, "")
  }

  if (!isAction(action)) {
    throw usageError(`无效版本动作：${action}`)
  }

  if (channel !== "latest" && action === "current") {
    throw usageError("预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。")
  }

  return action
}

/**
 * 确认是否执行冻结计划。
 *
 * @param ui - 终端 UI。
 * @returns 是否确认。
 */
export async function confirmExecution(ui: Ui): Promise<boolean> {
  return await confirm("确认执行冻结的发布计划？", ui.env.SCHEMX_UI_ASSUME_YES === "true")
}
