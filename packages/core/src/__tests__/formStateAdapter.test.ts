/**
 * FormStateAdapter 状态适配器单元测试。
 *
 * 验证 adapter 公共快照协议的稳定快照、生命周期与字段缓存语义。
 *
 * @module core/__tests__/formStateAdapter
 */

import { describe, expect, it, vi } from "vite-plus/test"

import { getFormStateAdapterContext } from "../adapter/formStateAdapter/context"
import { createForm } from "../createForm"
import { createField, createFormStateAdapter } from "../index"

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
    expect(store.values.getSnapshot()).toBe(
      getFormStateAdapterContext(form).store.state.values.peek()
    )
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
    expect(store.touchedFields.getSnapshot()).toBe(
      getFormStateAdapterContext(form).store.state.touchedFields.peek()
    )
    expect(store.touchedFields.getSnapshot()).toEqual(["profile.name", "name"])

    form.setFieldPending("name", true, "上传中")

    expect(pendingListener).toHaveBeenCalledTimes(1)
    expect(store.pendingFields.getSnapshot()).toBe(
      getFormStateAdapterContext(form).store.state.pendingFields.peek()
    )
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
    expect(snapshot.errors).toBe(
      getFormStateAdapterContext(form).store.state.field("profile.name").errors.peek()
    )
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

    const controller = createField(form, "name")

    form.setSchemas([
      { key: "field", name: "profile.name", label: "姓名", componentType: "input" },
    ])
    expect(form.getFieldName(controller.ref)).toBe("profile.name")
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

    getFormStateAdapterContext(form).store.state.values.subscribe(nativeListener)
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
    expect(store.values.getSnapshot()).toBe(
      getFormStateAdapterContext(form).store.state.values.peek()
    )
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

  it("共享原生状态来源并暴露配置与表单销毁状态", () => {
    const form = createTestForm()

    const adapter = createFormStateAdapter(form)

    const configChanged = vi.fn()

    const disposedChanged = vi.fn()

    expect(adapter.bind(getFormStateAdapterContext(form).store.state.values)).toBe(
      adapter.values
    )
    expect(adapter.bind(getFormStateAdapterContext(form).configuration.state)).toBe(
      adapter.config
    )
    adapter.config.subscribe(configChanged)
    adapter.disposed.subscribe(disposedChanged)
    form.setConfig({ schemaConfig: { disabled: true } })
    expect(configChanged).toHaveBeenCalledTimes(1)
    expect(adapter.config.getSnapshot().schemaConfig.disabled).toBe(true)
    expect(adapter.disposed.getSnapshot()).toBe(false)
    form.destroy()
    expect(disposedChanged).toHaveBeenCalledTimes(1)
    expect(adapter.disposed.getSnapshot()).toBe(true)
    adapter.dispose()
    expect(() =>
      adapter.bind(getFormStateAdapterContext(form).store.state.values)
    ).toThrow("disposed")
  })

  it("字段各属性可以独立订阅且与原生状态来源共享身份", () => {
    const form = createTestForm()

    const adapter = createFormStateAdapter(form)

    const field = adapter.field("name")

    const valueChanged = vi.fn()

    const errorsChanged = vi.fn()

    expect(field.value).toBe(
      adapter.bind(getFormStateAdapterContext(form).store.state.field("name").value)
    )
    field.value.subscribe(valueChanged)
    field.errors.subscribe(errorsChanged)
    form.setFieldErrors("name", ["invalid"])
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true)
    expect(valueChanged).not.toHaveBeenCalled()
    expect(errorsChanged).toHaveBeenCalledTimes(1)
    form.setFieldValue("name", "Grace")
    expect(valueChanged).toHaveBeenCalledTimes(1)
    expect(errorsChanged).toHaveBeenCalledTimes(1)
    adapter.dispose()
    form.destroy()
  })

  it("引用来源跟随节点移动并在节点替换后保持失效", () => {
    const form = createTestForm()

    form.setSchemas([
      { key: "field", name: "name", label: "姓名", componentType: "input" },
    ])
    const adapter = createFormStateAdapter(form)

    const controller = form.getFieldRef("name")

    const bound = adapter.field(controller)

    const changed = vi.fn()

    expect(adapter.field(controller)).toBe(bound)
    bound.value.subscribe(changed)
    form.setSchemas([
      { key: "field", name: "profile.name", label: "姓名", componentType: "input" },
    ])
    expect(bound.name.getSnapshot()).toBe("profile.name")
    expect(bound.value.getSnapshot()).toBe("Lovelace")
    expect(changed).toHaveBeenCalledTimes(1)
    form.setFieldErrors("profile.name", ["invalid"])
    form.setFieldTouched("profile.name", true)
    form.setFieldPending("profile.name", true)
    form.setSchemas([])
    expect(bound.disposed.getSnapshot()).toBe(true)
    expect(bound.name.getSnapshot()).toBeUndefined()
    expect(bound.getSnapshot()).toEqual({
      value: undefined,
      errors: [],
      touched: false,
      pending: false,
    })
    expect(bound.value.getSnapshot()).toBeUndefined()
    expect(bound.errors.getSnapshot()).toEqual([])
    expect(bound.touched.getSnapshot()).toBe(false)
    expect(bound.pending.getSnapshot()).toBe(false)
    form.setSchemas([
      { key: "replacement", name: "profile.name", label: "替换", componentType: "input" },
    ])
    expect(bound.value.getSnapshot()).toBeUndefined()
    adapter.dispose()
    form.destroy()
  })

  it("手动引用销毁后归一为空，固定路径来源仍保留原生状态", () => {
    const form = createTestForm()

    const adapter = createFormStateAdapter(form)

    const bound = adapter.field(form.getFieldRef("name"))

    const fixed = adapter.field("name")

    expect(fixed.value.getSnapshot()).toBe("Ada")

    const changed = vi.fn()

    bound.value.subscribe(changed)
    form.setFieldErrors("name", ["invalid"])
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true)
    form.destroy()
    expect(bound.getSnapshot()).toEqual({
      value: undefined,
      errors: [],
      touched: false,
      pending: false,
    })
    expect(bound.value.getSnapshot()).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(fixed.value.getSnapshot()).toBe("Ada")
    adapter.dispose()
  })

  it("ViewSchema 来源沿用防抖订阅且随 adapter 释放", async () => {
    vi.useFakeTimers()
    const form = createTestForm()

    const adapter = createFormStateAdapter(form)

    const changed = vi.fn()

    try {
      adapter.viewSchemas.subscribe(changed)
      expect(changed).not.toHaveBeenCalled()
      form.setSchemas([{ name: "name", label: "first", componentType: "input" }])
      form.setSchemas([{ name: "name", label: "second", componentType: "input" }])
      expect(adapter.viewSchemas.getSnapshot()).toBe(form.getViewSchemas())
      await vi.advanceTimersByTimeAsync(40)
      expect(changed).toHaveBeenCalled()
      expect(adapter.viewSchemas.getSnapshot()[0]?.label).toBe("second")
      const calls = changed.mock.calls.length

      adapter.dispose()
      form.setSchemas([])
      await vi.advanceTimersByTimeAsync(40)
      expect(changed).toHaveBeenCalledTimes(calls)
      expect(adapter.viewSchemas.getSnapshot()).toEqual([])
    } finally {
      adapter.dispose()
      form.destroy()
      vi.useRealTimers()
    }
  })
})
