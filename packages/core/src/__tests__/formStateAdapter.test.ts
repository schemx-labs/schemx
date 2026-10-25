/**
 * FormStateAdapter 状态适配器单元测试。
 *
 * 验证 adapter 公共快照协议的稳定快照、生命周期与字段缓存语义。
 *
 * @module core/__tests__/formStateAdapter
 */

import { describe, expect, it, vi } from "vite-plus/test"

import { createForm } from "../createForm"
import { createFormStateAdapter } from "../index"

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

describe("createFormStateAdapter", () => {
  it("提供稳定的全表快照，并且只在值变化后通知", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const listener = vi.fn()

    const initial = store.values.getSnapshot()

    expect(store.values.getSnapshot()).toBe(initial)

    const unsubscribe = store.values.subscribe(listener)

    expect(listener).not.toHaveBeenCalled()

    form.setFieldValue("name", "Grace")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.values.getSnapshot()).toBe(form.state.values.peek())
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

    const store = createFormStateAdapter(form)

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

  it("同一回调可以独立订阅、取消并重新订阅", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const listener = vi.fn()

    const first = store.values.subscribe(listener)

    const second = store.values.subscribe(listener)

    expect(listener).not.toHaveBeenCalled()
    form.setFieldValue("name", "Grace")
    expect(listener).toHaveBeenCalledTimes(2)
    first()
    first()
    form.setFieldValue("name", "Lin")
    expect(listener).toHaveBeenCalledTimes(3)
    second()
    second()
    form.setFieldValue("name", "Ada")
    expect(listener).toHaveBeenCalledTimes(3)
    const third = store.values.subscribe(listener)

    expect(listener).toHaveBeenCalledTimes(3)
    form.setFieldValue("name", "Grace")
    expect(listener).toHaveBeenCalledTimes(4)
    third()
    store.dispose()
    form.destroy()
  })

  it("复用同一路径的字段 Store，并仅在字段状态变化后通知", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

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

    const store = createFormStateAdapter(form)

    const touchedListener = vi.fn()

    const pendingListener = vi.fn()

    const unsubscribeTouched = store.touchedFields.subscribe(touchedListener)

    const unsubscribePending = store.pendingFields.subscribe(pendingListener)

    form.setFieldTouched("profile.name", true)
    form.setFieldTouched("name", true)

    expect(touchedListener).toHaveBeenCalledTimes(2)
    expect(store.touchedFields.getSnapshot()).toBe(form.state.touchedFields.peek())
    expect(store.touchedFields.getSnapshot()).toEqual(["profile.name", "name"])

    form.setFieldPending("name", true, "上传中")

    expect(pendingListener).toHaveBeenCalledTimes(1)
    expect(store.pendingFields.getSnapshot()).toBe(form.state.pendingFields.peek())
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

    const store = createFormStateAdapter(form)

    const listener = vi.fn()

    const field = store.field("name")

    field.subscribe(listener)
    store.dispose()
    store.dispose()
    form.setFieldValue("name", "Grace")

    expect(listener).not.toHaveBeenCalled()
    expect(form.getFieldValue("name")).toBe("Grace")
    expect(() => store.field("name")).toThrow("FormStateAdapter has been disposed")

    form.destroy()
  })

  it("聚合字段快照只发布批量更新的最终状态，净值不变时保持引用", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const field = store.field("profile.name")

    const listener = vi.fn()

    field.subscribe(listener)
    form.batch(() => {
      form.setFieldValue("profile.name", "Byron")
      form.setFieldErrors("profile.name", ["错误"])
      form.setFieldTouched("profile.name", true)
      form.setFieldPending("profile.name", true)
    })
    expect(listener).toHaveBeenCalledTimes(1)
    const snapshot = field.getSnapshot()

    expect(snapshot).toEqual({
      value: "Byron",
      errors: ["错误"],
      touched: true,
      pending: true,
    })
    expect(snapshot.errors).toBe(form.state.field("profile.name").errors.peek())
    form.batch(() => {
      form.setFieldTouched("profile.name", false)
      form.setFieldTouched("profile.name", true)
    })
    form.setFieldValue("age", 21)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(field.getSnapshot()).toBe(snapshot)
    store.dispose()
    form.destroy()
  })

  it("快照读取不建立依赖，监听器读取也不污染订阅目标", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const field = store.field("name")

    const snapshotReader = vi.fn(() => {
      store.values.getSnapshot()
      field.getSnapshot()
    })

    const listener = vi.fn(() => form.getFieldValue("age"))

    form.effect(snapshotReader)
    field.subscribe(listener)
    form.setFieldValue("name", "Grace")
    form.setFieldValue("age", 21)
    expect(snapshotReader).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)
    store.dispose()
    form.destroy()
  })

  it("字段来源保持固定路径，节点绑定的移动由字段控制器负责", () => {
    const form = createTestForm()

    form.setSchemas([
      { key: "field", name: "name", label: "姓名", componentType: "input" },
    ])
    const store = createFormStateAdapter(form)

    const fixed = store.field("name")

    const controller = form.createField("name")

    form.setSchemas([
      { key: "field", name: "profile.name", label: "姓名", componentType: "input" },
    ])
    expect(controller.state.name.value).toBe("profile.name")
    expect(controller.getValue()).toBe("Lovelace")
    expect(store.field("name")).toBe(fixed)
    expect(fixed.getSnapshot().value).toBe("Ada")
    controller.setValue("Byron")
    expect(fixed.getSnapshot().value).toBe("Ada")
    expect(store.field("profile.name").getSnapshot().value).toBe("Byron")
    store.dispose()
    form.destroy()
  })

  it("回调中可以释放适配器，释放后来源仍读取当前值且不再接受订阅", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const listener = vi.fn(() => store.dispose())

    const nativeListener = vi.fn()

    form.state.values.subscribe(nativeListener)
    const stop = store.values.subscribe(listener)

    form.setFieldValue("name", "Grace")
    const lateListener = vi.fn()

    store.values.subscribe(lateListener)()
    form.setFieldValue("name", "Lin")
    stop()
    store.dispose()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(lateListener).not.toHaveBeenCalled()
    expect(nativeListener).toHaveBeenCalledTimes(3)
    expect(store.values.getSnapshot()).toBe(form.state.values.peek())
    expect(store.values.getSnapshot().name).toBe("Lin")
    form.destroy()
  })

  it("Form 销毁停止适配器订阅，之后重复取消与释放仍安全", () => {
    const form = createTestForm()

    const store = createFormStateAdapter(form)

    const listener = vi.fn()

    const stop = store.values.subscribe(listener)

    form.setFieldValue("name", "Grace")
    form.destroy()
    store.values.subscribe(listener)()
    stop()
    store.dispose()
    store.dispose()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
