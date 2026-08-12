/**
 * Form External Store 单元测试。
 *
 * 验证 adapter 公共订阅协议的稳定快照、生命周期与字段缓存语义。
 *
 * @module core/__tests__/externalStore
 */

import { describe, expect, it, vi } from "vitest"

import { createFormExternalStore } from "../adapter"
import { createForm } from "../createForm"

interface FormValues {
  name: string
  age: number
  profile: {
    name: string
  }
}

const createTestForm = () =>
  createForm<FormValues>({
    initialValues: {
      name: "Ada",
      age: 20,
      profile: { name: "Lovelace" },
    },
  })

describe("createFormExternalStore", () => {
  it("提供稳定的全表快照，并且只在值变化后通知", () => {
    const form = createTestForm()

    const store = createFormExternalStore(form)

    const listener = vi.fn()

    const initial = store.values.getSnapshot()

    expect(store.values.getSnapshot()).toBe(initial)

    const unsubscribe = store.values.subscribe(listener)

    expect(listener).not.toHaveBeenCalled()

    form.setFieldValue("name", "Grace")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.values.getSnapshot()).toEqual({
      name: "Grace",
      age: 20,
      profile: { name: "Lovelace" },
    })
    expect(store.values.getSnapshot()).not.toBe(initial)

    form.setFieldValue("name", "Grace")

    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    form.destroy()
  })

  it("无 listener 时同步刷新快照，且 batch 只发布最终值", () => {
    const form = createTestForm()

    const store = createFormExternalStore(form)

    const listener = vi.fn()

    const initial = store.values.getSnapshot()

    form.setFieldValue("name", "Grace")

    expect(store.values.getSnapshot()).toEqual({
      name: "Grace",
      age: 20,
      profile: { name: "Lovelace" },
    })
    expect(store.values.getSnapshot()).not.toBe(initial)

    const unsubscribe = store.values.subscribe(listener)

    form.batch(() => {
      form.setFieldValue("name", "Lin")
      form.setFieldValue("age", 30)
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.values.getSnapshot()).toEqual({
      name: "Lin",
      age: 30,
      profile: { name: "Lovelace" },
    })

    unsubscribe()
    form.destroy()
  })

  it("首个 listener 启动 effect，最后一个 listener 停止 effect", () => {
    const form = createTestForm()

    const originalEffect = form.effect.bind(form)

    const disposeEffect = vi.fn()

    const effect = vi.spyOn(form, "effect").mockImplementation((callback) => {
      const dispose = originalEffect(callback)

      return () => {
        disposeEffect()
        dispose()
      }
    })

    const store = createFormExternalStore(form)

    const first = store.values.subscribe(vi.fn())

    const second = store.values.subscribe(vi.fn())

    expect(effect).toHaveBeenCalledTimes(1)

    first()
    expect(disposeEffect).not.toHaveBeenCalled()

    second()
    expect(disposeEffect).toHaveBeenCalledTimes(1)

    first()
    second()

    expect(disposeEffect).toHaveBeenCalledTimes(1)

    form.destroy()
  })

  it("复用同一路径的字段 Store，并仅在字段状态变化后通知", () => {
    const form = createTestForm()

    const store = createFormExternalStore(form)

    const first = store.field("profile.name")

    const second = store.field("profile.name")

    const listener = vi.fn()

    const initial = first.getSnapshot()

    const unsubscribe = first.subscribe(listener)

    expect(second).toBe(first)
    expect(initial).toEqual({
      value: "Lovelace",
      errors: [],
      touched: false,
      pending: false,
    })

    form.setFieldErrors("profile.name", ["无效名称"])
    form.setFieldTouched("profile.name", true)
    form.setFieldPending("profile.name", true, "保存中")
    form.setFieldValue("profile.name", "Byron")

    expect(listener).toHaveBeenCalledTimes(4)
    expect(first.getSnapshot()).toEqual({
      value: "Byron",
      errors: ["无效名称"],
      touched: true,
      pending: true,
    })

    form.setFieldErrors("profile.name", ["无效名称"])

    expect(listener).toHaveBeenCalledTimes(4)

    unsubscribe()
    form.destroy()
  })

  it("为 touched 和 pending 提供按内容稳定的聚合快照", () => {
    const form = createTestForm()

    const store = createFormExternalStore(form)

    const touchedListener = vi.fn()

    const pendingListener = vi.fn()

    const unsubscribeTouched = store.touchedFields.subscribe(touchedListener)

    const unsubscribePending = store.pendingFields.subscribe(pendingListener)

    form.setFieldTouched("profile.name", true)
    form.setFieldTouched("name", true)

    expect(touchedListener).toHaveBeenCalledTimes(2)
    expect(store.touchedFields.getSnapshot()).toEqual(["name", "profile.name"])

    form.setFieldPending("name", true, "上传中")

    expect(pendingListener).toHaveBeenCalledTimes(1)
    expect(store.pendingFields.getSnapshot()).toEqual([
      { field: "name", message: ["上传中"] },
    ])

    form.setFieldPending("name", true, "处理中")

    expect(pendingListener).toHaveBeenCalledTimes(2)
    expect(store.pendingFields.getSnapshot()).toEqual([
      { field: "name", message: ["处理中"] },
    ])

    unsubscribeTouched()
    unsubscribePending()
    form.destroy()
  })

  it("dispose 幂等且不销毁原始 Form", () => {
    const form = createTestForm()

    const store = createFormExternalStore(form)

    const listener = vi.fn()

    const field = store.field("name")

    field.subscribe(listener)
    store.dispose()
    store.dispose()
    form.setFieldValue("name", "Grace")

    expect(listener).not.toHaveBeenCalled()
    expect(form.getFieldValue("name")).toBe("Grace")
    expect(() => store.field("name")).toThrow("FormExternalStore has been disposed")

    form.destroy()
  })
})
