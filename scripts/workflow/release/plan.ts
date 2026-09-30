/**
 * 发布计划的创建与读取。
 *
 * @remarks 计划一旦创建，后续流程只读取其中的版本与发布配置。磁盘格式与原实现保持
 * 一致，便于历史计划文件继续可用。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

/** 计划文件的 schema 版本。 */
export const PLAN_SCHEMA_VERSION = 1

/** 计划中的一个发布包。 */
export interface PlanPackage {
  /** npm 包名。 */
  readonly name: string
  /** 逻辑包名，即 workspace 目录名。 */
  readonly package: string
  /** 当前 package.json 版本。 */
  readonly currentVersion: string
  /** 正式版本基线。 */
  readonly baselineVersion: string
  /** 实际发布版本。 */
  readonly version: string
  /** Git Tag 名称。 */
  readonly tag: string
}

/** 冻结的发布计划。 */
export interface ReleasePlan {
  /** schema 版本。 */
  readonly schemaVersion: number
  /** 发布通道。 */
  readonly channel: string
  /** 原始发布目标。 */
  readonly target: string
  /** 版本动作或精确版本。 */
  readonly versionAction: string
  /** 版本基线描述。 */
  readonly baselineVersion: string
  /** npm dist-tag。 */
  readonly distTag: string
  /** 源码提交短 SHA。 */
  readonly sourceSha: string
  /** 是否创建版本提交。 */
  readonly createCommit: boolean
  /** 是否创建 Git Tag。 */
  readonly createTag: boolean
  /** 是否创建 GitHub Release。 */
  readonly createGithubRelease: boolean
  /** 是否为预发布。 */
  readonly prerelease: boolean
  /** 发布包列表，已按发布顺序排列。 */
  readonly packages: readonly PlanPackage[]
}

/** 创建计划所需的输入。 */
export interface PlanDraft {
  /** 发布通道。 */
  readonly channel: string
  /** 原始发布目标。 */
  readonly target: string
  /** 版本动作或精确版本。 */
  readonly versionAction: string
  /** npm dist-tag。 */
  readonly distTag: string
  /** 源码提交短 SHA。 */
  readonly sourceSha: string
  /** 已计算好版本的发布包。 */
  readonly packages: readonly Omit<PlanPackage, "tag">[]
}

/**
 * 写入冻结计划。
 *
 * @param planFile - 计划文件绝对路径。
 * @param draft - 计划输入。
 */
export function writePlan(planFile: string, draft: PlanDraft): void {
  const isPrerelease = draft.channel !== "latest" && draft.channel !== "dev"

  const plan: ReleasePlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    channel: draft.channel,
    target: draft.target,
    versionAction: draft.versionAction,
    baselineVersion:
      draft.packages.length === 1
        ? (draft.packages[0]?.baselineVersion ?? "-")
        : "按包独立计算",
    distTag: draft.distTag,
    sourceSha: draft.sourceSha,
    createCommit: draft.channel === "latest",
    createTag: draft.channel !== "dev",
    createGithubRelease: draft.channel !== "dev",
    prerelease: isPrerelease,
    packages: draft.packages.map((item) => ({
      ...item,
      tag: `${item.name}@${item.version}`,
    })),
  }

  mkdirSync(path.dirname(planFile), { recursive: true })
  writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`)
}

/**
 * 读取并校验冻结计划。
 *
 * @param planFile - 计划文件绝对路径。
 * @returns 冻结计划。
 * @throws {Error} 文件缺失、JSON 非法或结构不完整时抛出。
 */
export function readPlan(planFile: string): ReleasePlan {
  const plan = JSON.parse(readFileSync(planFile, "utf8")) as ReleasePlan

  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION || !Array.isArray(plan.packages)) {
    throw new Error(`无效发布计划：${planFile}`)
  }

  if (plan.packages.length === 0) {
    throw new Error(`无效发布计划：${planFile}`)
  }

  for (const item of plan.packages) {
    if (!item.package || !item.name || !item.version || !item.tag) {
      throw new Error("发布计划缺少包信息")
    }
  }

  return plan
}
