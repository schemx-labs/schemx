/**
 * 动态属性解析工具单元测试
 *
 * 覆盖 resolveDynamicProp、resolveDynamicProps、resolveDynamicPropBatch。
 *
 * @module utils/__tests__/dynamic
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveDynamicProp,
  resolveDynamicPropBatch,
  resolveDynamicProps,
} from "../dynamic"

// 验证 resolveDynamicProp 解析静态值、函数值、空值默认值
describe("resolveDynamicProp", () => {
  it("解析静态值、函数值和空值默认值", async () => {
    await expect(resolveDynamicProp("hello", {}, "")).resolves.toBe("hello")
    await expect(
      resolveDynamicProp((values) => values.name, { name: "j" }, "")
    ).resolves.toBe("j")
    await expect(resolveDynamicProp(undefined, {}, "fallback")).resolves.toBe("fallback")
  })
})

// 验证 resolveDynamicProps 批量解析动态属性并保留每个字段的结果类型
describe("resolveDynamicProps", () => {
  it("批量解析动态属性并保留每个字段的结果类型", async () => {
    const results = await resolveDynamicProps(
      {
        placeholder: {
          value: (values) => `${values.label}为必填项`,
          defaultValue: "",
        },
        visible: {
          value: true,
          defaultValue: false,
        },
        count: {
          value: undefined,
          defaultValue: 1,
        },
      },
      { label: "姓名" }
    )

    expect(results).toEqual({
      placeholder: "姓名为必填项",
      visible: true,
      count: 1,
    })
  })
})

// 验证 resolveDynamicPropBatch 旧异步解析晚于新解析时不再提交旧结果
describe("resolveDynamicPropBatch", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("旧异步解析晚于新解析完成时，不再提交旧结果", async () => {
    vi.useFakeTimers()

    let resolveFirst!: (value: string) => void

    const firstValue = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })

    const callback = vi.fn()

    const resolveBatch = resolveDynamicPropBatch<{ placeholder: string }>(0)

    resolveBatch(
      {
        placeholder: {
          value: () => firstValue,
          defaultValue: "",
        },
      },
      {},
      callback
    )

    await vi.runOnlyPendingTimersAsync()

    resolveBatch(
      {
        placeholder: {
          value: "new",
          defaultValue: "",
        },
      },
      {},
      callback
    )

    await vi.runOnlyPendingTimersAsync()
    await Promise.resolve()

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenLastCalledWith({ placeholder: "new" })

    resolveFirst("old")
    await Promise.resolve()

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
