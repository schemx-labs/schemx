/**
 * 批处理执行器的行为测试。
 *
 * @remarks 覆盖内容与对应约束：
 * - 空列表直接返回 0，且不调用 `groupEnd`（避免打印「共执行 0 个目标」）；
 * - 全部成功时返回 0，且只调用一次 `groupEnd('success', ...)`，不弹失败摘要；
 * - 普通失败且 `keepGoing = false` 时立即停止：返回该失败码、逐行标出未执行目标、
 *   `groupEnd('failed', ...)`，剩余项的 `execute` 不得再被调用；
 * - 失败信息不再重复弹摘要卡片——逐行标记已是唯一来源，弹卡片只会重复同一批内容；
 * - 首错停止时把未执行的目标逐行标为「未执行」，而不再只用一句数量概括；
 * - `keepGoing = true` 时继续执行剩余项，汇总全部失败并返回**首个**失败码
 *   （原 shell 实现在 `--keep-going` 下收集到的失败顺序不稳定，可能返回最后一条退出码）；
 * - 退出码 130 表示用户取消：无论 `keepGoing` 取值都立即返回 130，只播报 `cancelled`；
 * - `identify` 生成的标识必须出现在失败文案中，`execute` 收到的 index/total 必须是 1-based；
 * - 列布局由本批次的实际内容决定，不跨批次泄漏。
 *
 * 用法：这里只走 `groupEnd`、`summary`、`taskPending` 与 `columns` 四个渲染入口，
 * 因此用结构化字面量伪造 Ui 实例。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { type BatchOptions, runBatch } from "./batch.ts"
import { type Outcome, type SummaryOptions, type Ui } from "./ui.ts"

/** 一次 groupEnd 调用记录。 */
interface GroupEndCall {
  readonly outcome: Outcome
  readonly message: string
}

/** 一次待办标记记录。 */
interface PendingCall {
  readonly target: string
  readonly label: string
  readonly reason: string
  readonly last: boolean
}

let groupEnds: GroupEndCall[] = []

let summaries: SummaryOptions[] = []

let pending: PendingCall[] = []

let executed: string[] = []

let progress: string[] = []

let columns: unknown = undefined

/** 只实现 runBatch 用到的渲染入口的假 Ui。 */
const ui = {
  groupEnd: (outcome: Outcome, message: string): void => {
    groupEnds.push({ outcome, message })
  },
  summary: (options: SummaryOptions): void => {
    summaries.push(options)
  },
  taskPending: (target: string, label: string, reason: string, last = false): void => {
    pending.push({ target, label, reason, last })
  },
  get columns(): unknown {
    return columns
  },
  set columns(value: unknown) {
    columns = value
  },
} as unknown as Ui

/**
 * 构造一次批处理调用，并记录执行顺序与进度参数。
 *
 * @param items - 待执行项。
 * @param codes - 每项的退出码；不足时按 0 补齐。
 * @param keepGoing - 是否在失败后继续。
 * @param identify - 失败标识生成函数。
 * @returns 批处理选项。
 */
function batchOptions(
  items: readonly string[],
  codes: readonly number[],
  keepGoing: boolean,
  identify: (item: string) => string = (item) => item
): BatchOptions<string> {
  return {
    label: "构建",
    items,
    keepGoing,
    identify,
    taskLabel: "build",
    execute: async (item, index, total) => {
      executed.push(item)
      progress.push(`${index}/${total}`)

      return codes[index - 1] ?? 0
    },
  }
}

/** 重置全部记录。 */
function reset(): void {
  groupEnds = []
  summaries = []
  pending = []
  executed = []
  progress = []
  columns = undefined
}

beforeEach(reset)
afterEach(reset)

describe("runBatch", () => {
  it("空列表返回 0 且不调用 groupEnd", async () => {
    const result = await runBatch(ui, batchOptions([], [], false))

    expect(result.exitCode).toBe(0)
    expect(result.cancelled).toBe(false)
    expect(executed).toEqual([])
    expect(groupEnds).toEqual([])
    expect(summaries).toEqual([])
  })

  it("全部成功返回 0，并且只播报一次 success", async () => {
    const result = await runBatch(
      ui,
      batchOptions(["core", "vue", "vant"], [0, 0, 0], false)
    )

    expect(result.exitCode).toBe(0)
    expect(executed).toEqual(["core", "vue", "vant"])
    expect(summaries).toEqual([])
    expect(groupEnds).toEqual([
      { outcome: "success", message: "构建完成：共执行 3 个目标。" },
    ])
  })

  it("失败且 keepGoing 为 false 时立即停止并返回该失败码", async () => {
    const result = await runBatch(
      ui,
      batchOptions(["core", "vue", "vant"], [0, 2, 0], false)
    )

    expect(result.exitCode).toBe(2)
    expect(executed).toEqual(["core", "vue"])
    expect(summaries).toEqual([])
    expect(groupEnds).toEqual([
      { outcome: "failed", message: "构建失败：vue。另有 1 个目标未执行。" },
    ])
  })

  it("首错停止时逐行标出未执行的目标", async () => {
    await runBatch(ui, batchOptions(["core", "vue", "vant", "wot"], [0, 2, 0, 0], false))

    expect(pending).toEqual([
      { target: "vant", label: "", reason: "未执行", last: false },
      { target: "wot", label: "", reason: "未执行", last: true },
    ])
  })

  it("keepGoing 为 true 时不产生未执行标记", async () => {
    await runBatch(ui, batchOptions(["core", "vue", "vant"], [0, 3, 5], true))

    expect(pending).toEqual([])
  })

  it("keepGoing 为 true 时执行剩余项并返回首个失败码", async () => {
    const result = await runBatch(
      ui,
      batchOptions(["core", "vue", "vant"], [0, 3, 5], true)
    )

    expect(result.exitCode).toBe(3)
    expect(executed).toEqual(["core", "vue", "vant"])
    expect(summaries).toEqual([])
    expect(groupEnds).toEqual([
      { outcome: "failed", message: "构建未全部完成：2 个目标未通过。" },
    ])
  })

  it("keepGoing 为 true 且只有一项失败时同样走失败汇总", async () => {
    const result = await runBatch(
      ui,
      batchOptions(["core", "vue", "vant"], [0, 7, 0], true)
    )

    expect(result.exitCode).toBe(7)
    expect(groupEnds).toEqual([
      { outcome: "failed", message: "构建未全部完成：1 个目标未通过。" },
    ])
  })

  it("退出码 130 立即返回 130，且只播报 cancelled", async () => {
    const result = await runBatch(
      ui,
      batchOptions(["core", "vue", "vant"], [0, 130, 0], true)
    )

    expect(result.exitCode).toBe(130)
    expect(result.cancelled).toBe(true)
    expect(executed).toEqual(["core", "vue"])
    expect(summaries).toEqual([])
    expect(groupEnds).toEqual([{ outcome: "cancelled", message: "构建已取消：vue。" }])
  })

  it("取消后把剩余目标标为未执行", async () => {
    await runBatch(ui, batchOptions(["core", "vue", "vant"], [0, 130, 0], true))

    expect(pending).toEqual([{ target: "vant", label: "", reason: "未执行", last: true }])
  })

  it("首项被取消时直接返回 130", async () => {
    const result = await runBatch(ui, batchOptions(["core", "vue"], [130, 0], false))

    expect(result.exitCode).toBe(130)
    expect(executed).toEqual(["core"])
    expect(groupEnds).toEqual([{ outcome: "cancelled", message: "构建已取消：core。" }])
  })

  it("identify 提供的标识出现在失败信息里", async () => {
    const options = batchOptions(["packages/vue"], [1], false, (item) => `目标 ${item}`)

    const result = await runBatch(ui, options)

    expect(result.exitCode).toBe(1)
    expect(groupEnds[0]?.message).toBe("构建失败：目标 packages/vue。")
  })

  it("execute 收到的 index 与 total 是 1-based", async () => {
    await runBatch(ui, batchOptions(["a", "b", "c"], [0, 0, 0], false))

    expect(progress).toEqual(["1/3", "2/3", "3/3"])
  })

  it("按本批次的实际内容设置列布局", async () => {
    await runBatch(
      ui,
      batchOptions(["@schemx/core", "@schemx/element-plus"], [0, 0], false)
    )

    expect(columns).toEqual({ target: 20, label: 10, duration: 7 })
  })
})
