/**
 * createComputed 响应式计算测试。
 *
 * 覆盖 computed 的只读语义、自动依赖追踪、懒计算、链式 computed 以及
 * 复杂对象/数组类型支持。
 *
 * @module core/reactivity/__tests__/computed.test
 */

import { describe, expect, it } from "vitest"

import { createComputed } from "../computed"
import { createSignal } from "../signal"

// createComputed 核心功能：只读、依赖追踪、懒计算、链式、复杂类型
describe("createComputed", () => {
  it("应该返回只读 signal", () => {
    const c = createComputed(() => 42)

    expect(c.value).toBe(42)
    // ComputedSignal 是 ReadonlySignal，不可写入
  })

  it("应该自动追踪依赖 signal", () => {
    const a = createSignal(1)

    const b = createSignal(2)

    const sum = createComputed(() => a.value + b.value)

    expect(sum.value).toBe(3)

    a.value = 10
    expect(sum.value).toBe(12)

    b.value = 5
    expect(sum.value).toBe(15)
  })

  it("应该懒计算：依赖未变化时不重新求值", () => {
    let computeCount = 0

    const a = createSignal(1)

    const c = createComputed(() => {
      computeCount++

      return a.value * 2
    })

    // 第一次读取触发计算
    expect(c.value).toBe(2)
    expect(computeCount).toBe(1)

    // 再次读取，依赖未变，不重新计算
    expect(c.value).toBe(2)
    expect(computeCount).toBe(1)

    // 依赖变化后重新计算
    a.value = 5
    expect(c.value).toBe(10)
    expect(computeCount).toBe(2)
  })

  it("应该支持链式 computed", () => {
    const a = createSignal(1)

    const double = createComputed(() => a.value * 2)

    const quadruple = createComputed(() => double.value * 2)

    expect(quadruple.value).toBe(4)

    a.value = 3
    expect(quadruple.value).toBe(12)
  })

  it("应该支持复杂对象类型", () => {
    const first = createSignal("Hello")

    const last = createSignal("World")

    const full = createComputed(() => ({
      first: first.value,
      last: last.value,
      full: `${first.value} ${last.value}`,
    }))

    expect(full.value).toEqual({
      first: "Hello",
      last: "World",
      full: "Hello World",
    })

    first.value = "Hi"
    expect(full.value).toEqual({
      first: "Hi",
      last: "World",
      full: "Hi World",
    })
  })

  it("应该支持数组类型", () => {
    const items = createSignal([1, 2, 3])

    const count = createComputed(() => items.value.length)

    expect(count.value).toBe(3)

    items.value = [1, 2, 3, 4, 5]
    expect(count.value).toBe(5)
  })
})
