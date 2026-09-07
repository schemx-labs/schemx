/**
 * createStrictSingleton 严格单例工厂单元测试
 *
 * 覆盖首次创建、幂等性、工厂返回 null/undefined 抛错、
 * reset 后重新创建、带参数的工厂、返回对象冻结。
 *
 * @module utils/__tests__/single
 */
import { describe, expect, it } from "vitest"

import { createStrictSingleton } from "../single"

// 验证 createStrictSingleton 的首次创建、幂等性、工厂返回 null/undefined 抛错、reset 后重新创建、返回对象冻结
describe("createStrictSingleton", () => {
  it("首次调用 getInstance 执行工厂函数并返回实例", () => {
    const singleton = createStrictSingleton(() => ({ value: 42 }))

    const instance = singleton.getInstance()

    expect(instance).toEqual({ value: 42 })
  })

  it("多次调用 getInstance 返回同一实例引用", () => {
    const singleton = createStrictSingleton(() => ({ value: 42 }))

    const a = singleton.getInstance()

    const b = singleton.getInstance()

    expect(a).toBe(b)
  })

  it("工厂返回 null 抛出包含 [Singleton] 前缀的错误", () => {
    const singleton = createStrictSingleton(() => null as any)

    expect(() => singleton.getInstance()).toThrow("[Singleton]")
  })

  it("工厂返回 undefined 抛出包含 [Singleton] 前缀的错误", () => {
    const singleton = createStrictSingleton(() => undefined as any)

    expect(() => singleton.getInstance()).toThrow("[Singleton]")
  })

  it("reset 后再次调用 getInstance 重新执行工厂函数", () => {
    let count = 0

    const singleton = createStrictSingleton(() => ({ id: ++count }))

    const first = singleton.getInstance()

    expect(first.id).toBe(1)

    singleton.reset()

    const second = singleton.getInstance()

    expect(second.id).toBe(2)
    expect(first).not.toBe(second)
  })

  it("带参数的工厂：首次使用参数创建，后续忽略参数返回同一实例", () => {
    const singleton = createStrictSingleton((name: string) => ({ name }))

    const a = singleton.getInstance("first")

    expect(a.name).toBe("first")

    const b = singleton.getInstance("second")

    expect(b.name).toBe("first")
    expect(a).toBe(b)
  })

  it("返回的对象是冻结的", () => {
    const singleton = createStrictSingleton(() => ({ value: 1 }))

    expect(Object.isFrozen(singleton)).toBe(true)
  })
})
