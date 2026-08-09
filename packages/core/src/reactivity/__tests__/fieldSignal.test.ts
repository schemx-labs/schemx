/**
 * FieldSignal / FieldSignalMap 单元测试。
 *
 * @module core/reactivity/__tests__/fieldSignal.test
 */

import { describe, expect, it, vi } from "vitest"

import { createSignalEffect } from "../effect"
import { createFieldSignal } from "../fieldSignal"
import { createFieldSignalMap } from "../fieldSignalMap"
import { createSignal } from "../signal"

// createSignal 的 subscribe / name / valueOf / toJSON 等转换能力
describe("createSignal", () => {
  it("应该支持 signals-core 的 subscribe / name / value 转换能力", () => {
    const watched = vi.fn()

    const unwatched = vi.fn()

    const count = createSignal(1, { name: "count", watched, unwatched })

    const listener = vi.fn()

    const unsubscribe = count.subscribe(listener)

    expect(count.name).toBe("count")
    expect(watched).toHaveBeenCalledTimes(1)

    count.value = 2

    expect(listener).toHaveBeenCalledWith(2)
    expect(count.peek()).toBe(2)
    expect(count.valueOf()).toBe(2)
    expect(count.toString()).toBe("2")
    expect(count.toJSON()).toBe(2)

    unsubscribe()

    expect(unwatched).toHaveBeenCalledTimes(1)
  })

  it("应该支持无初始值创建 signal", () => {
    const value = createSignal<string>()

    expect(value.value).toBeUndefined()

    value.value = "ready"

    expect(value.peek()).toBe("ready")
  })
})

// createFieldSignal 管理字段值、初始值、touched 和 pending 状态
describe("createFieldSignal", () => {
  it("应该管理字段值、初始值、touched 和 pending", () => {
    const field = createFieldSignal({
      value: "initial",
      initialValue: "initial",
    })

    expect(field.value.value).toBe("initial")
    expect(field.initialValue.value).toBe("initial")
    expect(field.touched.value).toBe(false)
    expect(field.pending.value).toBe(false)

    field.setValue("changed")
    field.setTouched(true)
    field.setPending(true)

    expect(field.value.value).toBe("changed")
    expect(field.touched.value).toBe(true)
    expect(field.pending.value).toBe(true)
    expect(field.peek()).toEqual({
      value: "changed",
      initialValue: "initial",
      touched: true,
      pending: true,
      pendingMessage: [],
    })

    field.reset()

    expect(field.value.value).toBe("initial")
    expect(field.touched.value).toBe(false)
    expect(field.pending.value).toBe(false)
  })
})

// FieldSignalMap 按路径创建/查询/删除字段 signal，并支持数组路径标准化
describe("FieldSignalMap", () => {
  it("应该按路径创建、查询和删除字段 signal", () => {
    const map = createFieldSignalMap<string, number>()

    const signal = createFieldSignal({ value: 18, initialValue: 18 })

    map.set("age", signal)
    expect(map.get("age")).toBe(signal)
    expect(signal.value.value).toBe(18)

    map.delete("age")

    expect(map.peek("age")).toBeUndefined()
    expect(signal.value.value).toBeUndefined()
    expect(signal.initialValue.value).toBeUndefined()
  })

  it("读取缺失字段后，字段创建应该触发 effect 重新运行", () => {
    const map = createFieldSignalMap<string, number>()

    const seen: Array<number | undefined> = []

    const dispose = createSignalEffect(() => {
      seen.push(map.get("age")?.value.value)
    })

    map.set("age", createFieldSignal({ value: 18, initialValue: 18 }))

    expect(seen).toEqual([undefined, 18])

    dispose()
  })

  it("应该支持数组路径默认标准化", () => {
    const map = createFieldSignalMap<Array<string | number>, string>()

    const signal = createFieldSignal({ value: "Ada", initialValue: "Ada" })

    map.set(["user", "name"], signal)
    expect(map.get(["user", "name"])).toBe(signal)
  })
})
