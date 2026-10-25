/** 批处理首错停止、继续执行、未执行反馈与取消策略的回归测试。 */
import { Writable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { type BatchOptions, runBatch } from "./batch.ts"
import { createTerminal } from "./ui/index.ts"

import type { Outcome, SummaryOptions, Terminal } from "./ui/index.ts"

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
}

let groupEnds: GroupEndCall[] = []

let summaries: SummaryOptions[] = []

let pending: PendingCall[] = []

let executed: string[] = []

let progress: string[] = []

let terminal: Terminal

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
  terminal?.dispose()
  terminal = createTerminal({
    output: new Writable({
      write(_chunk, _encoding, done) {
        done()
      },
    }),
    handleSignals: false,
  })
  vi.spyOn(terminal, "endGroup").mockImplementation(({ outcome, message }) => {
    groupEnds.push({ outcome, message })
  })
  vi.spyOn(terminal, "summary").mockImplementation((options) => {
    summaries.push(options)
  })
  vi.spyOn(terminal, "pendingTask").mockImplementation(({ target, title, reason }) => {
    pending.push({ target, label: title ?? "", reason })
  })
}

beforeEach(reset)
afterEach(() => {
  terminal.dispose()
})

describe("runBatch", () => {
  it("空列表返回 0 且不调用 groupEnd", async () => {
    const result = await runBatch(terminal, batchOptions([], [], false))

    expect(result.exitCode).toBe(0)
    expect(result.cancelled).toBe(false)
    expect(executed).toEqual([])
    expect(groupEnds).toEqual([])
    expect(summaries).toEqual([])
  })

  it("全部成功返回 0，并且只播报一次 success", async () => {
    const result = await runBatch(
      terminal,
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
      terminal,
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
    await runBatch(
      terminal,
      batchOptions(["core", "vue", "vant", "wot"], [0, 2, 0, 0], false)
    )

    expect(pending).toEqual([
      { target: "vant", label: "", reason: "未执行" },
      { target: "wot", label: "", reason: "未执行" },
    ])
  })

  it("keepGoing 为 true 时不产生未执行标记", async () => {
    await runBatch(terminal, batchOptions(["core", "vue", "vant"], [0, 3, 5], true))

    expect(pending).toEqual([])
  })

  it("keepGoing 为 true 时执行剩余项并返回首个失败码", async () => {
    const result = await runBatch(
      terminal,
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
      terminal,
      batchOptions(["core", "vue", "vant"], [0, 7, 0], true)
    )

    expect(result.exitCode).toBe(7)
    expect(groupEnds).toEqual([
      { outcome: "failed", message: "构建未全部完成：1 个目标未通过。" },
    ])
  })

  it("退出码 130 立即返回 130，且只播报 cancelled", async () => {
    const result = await runBatch(
      terminal,
      batchOptions(["core", "vue", "vant"], [0, 130, 0], true)
    )

    expect(result.exitCode).toBe(130)
    expect(result.cancelled).toBe(true)
    expect(executed).toEqual(["core", "vue"])
    expect(summaries).toEqual([])
    expect(groupEnds).toEqual([{ outcome: "cancelled", message: "构建已取消：vue。" }])
  })

  it("取消后把剩余目标标为未执行", async () => {
    await runBatch(terminal, batchOptions(["core", "vue", "vant"], [0, 130, 0], true))

    expect(pending).toEqual([{ target: "vant", label: "", reason: "未执行" }])
  })

  it("首项被取消时直接返回 130", async () => {
    const result = await runBatch(
      terminal,
      batchOptions(["core", "vue"], [130, 0], false)
    )

    expect(result.exitCode).toBe(130)
    expect(executed).toEqual(["core"])
    expect(groupEnds).toEqual([{ outcome: "cancelled", message: "构建已取消：core。" }])
  })

  it("identify 提供的标识出现在失败信息里", async () => {
    const options = batchOptions(["packages/vue"], [1], false, (item) => `目标 ${item}`)

    const result = await runBatch(terminal, options)

    expect(result.exitCode).toBe(1)
    expect(groupEnds[0]?.message).toBe("构建失败：目标 packages/vue。")
  })

  it("execute 收到的 index 与 total 是 1-based", async () => {
    await runBatch(terminal, batchOptions(["a", "b", "c"], [0, 0, 0], false))

    expect(progress).toEqual(["1/3", "2/3", "3/3"])
  })

  it("批处理不修改终端内部布局状态", async () => {
    await runBatch(
      terminal,
      batchOptions(["@schemx/core", "@schemx/element-plus"], [0, 0], false)
    )

    expect(terminal).not.toHaveProperty("columns")
    expect(terminal).not.toHaveProperty("depth")
  })
})
