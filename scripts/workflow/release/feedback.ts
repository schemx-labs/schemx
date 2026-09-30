/**
 * 发布计划与结果的终端呈现。
 */
import { type Ui } from "../ui/ui.ts"

import { type ReleasePlan } from "./plan.ts"
import { progressText } from "./state.ts"

/**
 * 把可空字段渲染为占位符。
 *
 * @param value - 字段值。
 * @returns 渲染后的文本。
 */
function value(raw: string | undefined | null): string {
  return raw === undefined || raw === null || raw === "" ? "-" : raw
}

/**
 * 把布尔字段渲染为是/否。
 *
 * @param flag - 字段值。
 * @returns 渲染后的文本。
 */
function yesNo(flag: boolean | undefined): string {
  return flag === true ? "是" : "否"
}

/**
 * 生成发布计划的完整展示文本。
 *
 * @param plan - 冻结计划。
 * @returns 多行文本。
 */
export function planText(plan: ReleasePlan): string {
  const githubRelease = plan.createGithubRelease
    ? `是${plan.prerelease === true ? "（预发布）" : ""}`
    : "否"

  const header = [
    `通道：${value(plan.channel)}`,
    `目标：${value(plan.target)}`,
    `版本动作：${value(plan.versionAction)}`,
    `版本基线：${value(plan.baselineVersion)}`,
    `npm tag：${value(plan.distTag)}`,
    `版本提交：${yesNo(plan.createCommit)}`,
    `Git Tag：${yesNo(plan.createTag)}`,
    `GitHub Release：${githubRelease}`,
  ].join("\n")

  const packages = plan.packages
    .map((item) => {
      const from = item.currentVersion ? `${item.currentVersion} → ` : ""

      return `${item.name}\n  ${from}${value(item.version)}`
    })
    .join("\n")

  return `${header}\n\n发布包（按发布顺序）\n${packages}`
}

/**
 * 展示发布计划。
 *
 * @param ui - 终端 UI。
 * @param plan - 冻结计划。
 */
export function renderPlan(ui: Ui, plan: ReleasePlan): void {
  ui.summary({ title: "发布计划", tone: "neutral", content: planText(plan) })
}

/**
 * 展示发布结果。
 *
 * @param ui - 终端 UI。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 */
export function renderOutcome(ui: Ui, plan: ReleasePlan, planFile: string): void {
  ui.summary({
    title: "发布结果",
    tone: "success",
    content: `发布完成\n${progressText(plan, planFile)}`,
  })
}
