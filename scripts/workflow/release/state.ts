/**
 * 发布进度状态。
 *
 * @remarks 状态文件与冻结计划同目录，逐包记录已经完成的不可逆步骤，让部分成功后
 * 可以判断哪些步骤可以跳过、哪些必须补做。
 *
 * 原实现对「状态文件损坏」有三种互相矛盾的策略（跳过 / 退出码 2 / 退出码 2），
 * 且退出码 2 在两个调用点被吞掉，最终会回滚全部已发布包的版本。这里统一为：
 * 任何读取失败都抛出错误，由调用方决定中止流程，绝不在状态不可信时执行回滚。
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"

import { type PlanPackage, type ReleasePlan } from "./plan.ts"

/** 状态文件的 schema 版本。 */
export const STATE_SCHEMA_VERSION = 1

/** 不可逆的发布步骤。 */
export const STATE_STEPS = ["published", "tagged", "released"] as const

/** 不可逆的发布步骤。 */
export type StateStep = (typeof STATE_STEPS)[number]

/** 步骤的中文标签。 */
const STEP_LABELS: Readonly<Record<StateStep, string>> = {
  published: "已发布",
  tagged: "已建 Tag",
  released: "已建 Release",
}

/** 状态文件中一个包的进度。 */
export interface StatePackage {
  /** 逻辑包名。 */
  readonly package: string
  /** npm 包名。 */
  readonly name: string
  /** 实际发布版本。 */
  readonly version: string
  /** npm 发布是否完成。 */
  readonly published: boolean
  /** Git Tag 是否已推送。 */
  readonly tagged: boolean
  /** GitHub Release 是否已创建。 */
  readonly released: boolean
}

/** 发布进度状态。 */
export interface ReleaseState {
  /** schema 版本。 */
  readonly schemaVersion: number
  /** 发布通道。 */
  readonly channel: string | null
  /** 源码提交短 SHA。 */
  readonly sourceSha: string | null
  /** 逐包进度。 */
  readonly packages: readonly StatePackage[]
}

/**
 * 返回状态文件路径。
 *
 * @param planFile - 计划文件路径。
 * @returns 状态文件路径。
 */
export function statePath(planFile: string): string {
  return `${planFile}.state.json`
}

/**
 * 删除状态文件；不存在时保持幂等。
 *
 * @param planFile - 计划文件路径。
 */
export function removeState(planFile: string): void {
  rmSync(statePath(planFile), { force: true })
}

/**
 * 读取状态文件。
 *
 * @param planFile - 计划文件路径。
 * @returns 状态；文件不存在时返回 undefined。
 * @throws {Error} 状态文件存在但内容非法时抛出。
 */
export function readState(planFile: string): ReleaseState | undefined {
  const file = statePath(planFile)

  if (!existsSync(file)) {
    return undefined
  }

  const state = JSON.parse(readFileSync(file, "utf8")) as ReleaseState

  if (state.schemaVersion !== STATE_SCHEMA_VERSION || !Array.isArray(state.packages)) {
    throw new Error(`发布进度状态无效：${file}`)
  }

  return state
}

/**
 * 判断某个包是否已完成某一步骤。
 *
 * @param planFile - 计划文件路径。
 * @param target - 逻辑包名。
 * @param step - 步骤。
 * @returns 是否已完成。
 * @throws {Error} 状态文件损坏时抛出。
 */
export function hasStep(planFile: string, target: string, step: StateStep): boolean {
  return (readState(planFile)?.packages ?? []).some(
    (item) => item.package === target && item[step] === true
  )
}

/**
 * 标记某个包完成一步骤；状态文件不存在时按冻结计划创建。
 *
 * @param planFile - 计划文件路径。
 * @param plan - 冻结计划。
 * @param target - 逻辑包名。
 * @param step - 步骤。
 * @throws {Error} 步骤非法、引用计划外的包或状态文件损坏时抛出。
 */
export function markStep(
  planFile: string,
  plan: ReleasePlan,
  target: string,
  step: StateStep
): void {
  if (!STATE_STEPS.includes(step)) {
    throw new Error(`未知发布进度步骤：${step}`)
  }

  const planned = plan.packages.find((item) => item.package === target)

  if (!planned) {
    throw new Error(`发布进度无法引用计划外的包：${target}`)
  }

  const file = statePath(planFile)

  const state: ReleaseState = readState(planFile) ?? {
    schemaVersion: STATE_SCHEMA_VERSION,
    channel: plan.channel,
    sourceSha: plan.sourceSha,
    packages: [],
  }

  const existing = state.packages.find((item) => item.package === target)

  const entry: StatePackage = {
    package: target,
    name: planned.name,
    version:
      step === "published" ? planned.version : (existing?.version ?? planned.version),
    published: step === "published" ? true : (existing?.published ?? false),
    tagged: step === "tagged" ? true : (existing?.tagged ?? false),
    released: step === "released" ? true : (existing?.released ?? false),
  }

  const packages = [...state.packages.filter((item) => item.package !== target), entry]

  const temporary = `${file}.${process.pid}.tmp`

  writeFileSync(temporary, `${JSON.stringify({ ...state, packages }, null, 2)}\n`)
  renameSync(temporary, file)
}

/**
 * 返回已发布的包记录，按冻结计划顺序排列。
 *
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @returns 已发布包列表。
 * @throws {Error} 状态文件损坏时抛出。
 */
export function publishedRecords(
  plan: ReleasePlan,
  planFile: string
): readonly PlanPackage[] {
  const state = readState(planFile)

  if (!state) {
    return []
  }

  const published = new Map(
    state.packages.filter((item) => item.published).map((item) => [item.package, item])
  )

  return plan.packages.flatMap((item) => {
    const entry = published.get(item.package)

    return entry ? [{ ...item, version: entry.version || item.version }] : []
  })
}

/**
 * 返回已发布包的逻辑名集合。
 *
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @returns 逻辑包名集合。
 * @throws {Error} 状态文件损坏时抛出。
 */
export function publishedNames(plan: ReleasePlan, planFile: string): ReadonlySet<string> {
  return new Set(publishedRecords(plan, planFile).map((item) => item.package))
}

/**
 * 生成发布进度的多行文本，用于中断与结果摘要。
 *
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @returns 多行进度文本。
 * @throws {Error} 状态文件损坏时抛出。
 */
export function progressText(plan: ReleasePlan, planFile: string): string {
  const state = readState(planFile)

  const progress = new Map((state?.packages ?? []).map((item) => [item.package, item]))

  const applies: readonly StateStep[] = [
    "published",
    ...(plan.createTag ? (["tagged"] as const) : []),
    ...(plan.createGithubRelease ? (["released"] as const) : []),
  ]

  return plan.packages
    .map((item) => {
      const entry = progress.get(item.package)

      if (!entry) {
        return `${item.name}@${item.version}  未执行`
      }

      const done = applies
        .filter((step) => entry[step] === true)
        .map((step) => STEP_LABELS[step])

      return `${item.name}@${item.version}  ${done.length > 0 ? done.join("、") : "进行中"}`
    })
    .join("\n")
}

/**
 * 确认状态文件与冻结计划一致。
 *
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @throws {Error} 状态记录引用了计划外的包，或版本与计划不一致时抛出。
 */
export function assertMatchesPlan(plan: ReleasePlan, planFile: string): void {
  const state = readState(planFile)

  if (!state) {
    return
  }

  const planned = new Map(plan.packages.map((item) => [item.package, item.version]))

  for (const item of state.packages) {
    const expected = planned.get(item.package)

    if (expected === undefined || (item.version !== "" && item.version !== expected)) {
      throw new Error(
        `发布进度与冻结计划不一致：${item.package}@${item.version}，计划为 ${expected ?? "未包含"}`
      )
    }
  }
}
