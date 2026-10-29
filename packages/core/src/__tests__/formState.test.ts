import { describe, expect, it, vi } from "vite-plus/test"

import { getFormStateAdapterContext } from "../adapter/formStateAdapter/context"
import { createField, createForm, createFormStateAdapter } from "../index"

import type { Values } from "../index"

/**
 * 创建包含对象与数组的表单，以验证结构共享和字段状态。
 */
function createTestForm() {
  return createForm({
    initialValues: {
      name: "Ada",
      age: 20,
      profile: { name: "Lovelace", email: "ada@example.com" },
      tags: ["first"],
    },
  })
}

describe("Core 表单底层状态", () => {
  it("状态直接来自 Model 与 Store，字段控制器复用同一路径的状态来源", () => {
    const form = createForm<Values>({ initialValues: { profile: { name: "Lovelace" } } })

    const state = getFormStateAdapterContext(form).store.state

    const field = state.field("profile.name")

    const effect = vi.spyOn(form, "effect")

    expect(form).not.toHaveProperty("state")
    expect(getFormStateAdapterContext(form).store.state).toBe(state)
    expect(state.field("profile[name]")).toBe(field)
    const controller = createField(form, "profile.name")

    expect(createField(form, "profile.name").ref).toBe(controller.ref)
    expect(controller.state.value.peek()).toBe(field.value.peek())
    expect(controller.state.errors.peek()).toBe(field.errors.peek())
    expect(controller.state.touched.peek()).toBe(field.touched.peek())
    expect(controller.state.pending.peek()).toBe(field.pending.peek())
    expect(field.value.value).toBe("Lovelace")
    expect(field.value.peek()).toBe("Lovelace")
    expect(field.errors.value).toBe(field.errors.value)
    expect(state.values.value).toBe(state.values.value)
    expect(effect).not.toHaveBeenCalled()
    expect("getSnapshot" in field.value).toBe(false)
    expect("dispose" in state).toBe(false)
    form.setFieldValue("profile.name", "Byron")
    expect(field.value.value).toBe("Byron")
    form.destroy()
  })

  it("保留直接属性的字符串路径语义", () => {
    const form = createForm({ initialValues: { "profile.name": "Ada" } })

    expect(
      getFormStateAdapterContext(form).store.state.field("profile.name").value.value
    ).toBe("Ada")
    form.destroy()
  })

  it("订阅立即交付当前值，字段各属性独立通知并稳定错误消息引用", () => {
    const form = createTestForm()

    const field = getFormStateAdapterContext(form).store.state.field("name")

    const value = vi.fn()

    const errors = vi.fn()

    const touched = vi.fn()

    const pending = vi.fn()

    field.value.subscribe(value)
    field.errors.subscribe(errors)
    field.touched.subscribe(touched)
    field.pending.subscribe(pending)

    expect(value).toHaveBeenCalledWith("Ada")
    expect(errors).toHaveBeenCalledWith([])
    form.setFieldValue("age", 21)
    form.setFieldErrors("name", ["错误"])
    const firstErrors = field.errors.value

    form.setFieldErrors("name", ["错误"])
    expect(field.errors.value).toBe(firstErrors)
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true)
    expect(value).toHaveBeenCalledTimes(1)
    form.setFieldValue("name", "Grace")
    expect(value).toHaveBeenCalledTimes(2)
    expect(errors).toHaveBeenCalledTimes(2)
    expect(touched).toHaveBeenCalledTimes(2)
    expect(pending).toHaveBeenCalledTimes(2)
    form.destroy()
  })

  it("只读值直接复用结构共享树，祖先更新不改变未变化的子树", () => {
    const form = createTestForm()

    const profile = getFormStateAdapterContext(form).store.state.field("profile").value

    const tags = getFormStateAdapterContext(form).store.state.field("tags").value

    const initialProfile = profile.value

    const initialTags = tags.value

    const changed = vi.fn()

    const tagChanged = vi.fn()

    profile.subscribe(changed)
    tags.subscribe(tagChanged)

    expect(profile.value).toBe(form.getFieldValue("profile"))
    expect(form.getFieldSnapshot("profile")).not.toBe(profile.value)
    form.setFieldValue("age", 21)
    expect(profile.value).toBe(initialProfile)
    expect(tags.value).toBe(initialTags)
    form.setFieldValue("profile.name", "Byron")
    expect(profile.value).toEqual({ name: "Byron", email: "ada@example.com" })
    expect(initialProfile).toEqual({ name: "Lovelace", email: "ada@example.com" })
    form.setFieldValue("tags.0", "second")
    expect(tags.value).toEqual(["second"])
    expect(initialTags).toEqual(["first"])
    expect(changed).toHaveBeenCalledTimes(2)
    expect(tagChanged).toHaveBeenCalledTimes(2)
    form.destroy()
  })

  it("批量写入只交付最终值，peek 不建立 Core effect 依赖", () => {
    const form = createTestForm()

    const name = getFormStateAdapterContext(form).store.state.field("name").value

    const observed: Array<string | undefined> = []

    const values = vi.fn()

    const untracked = vi.fn(() => {
      name.peek()
    })

    name.subscribe((value) => observed.push(value))
    getFormStateAdapterContext(form).store.state.values.subscribe(values)
    form.effect(untracked)
    form.batch(() => {
      form.setFieldValue("name", "Grace")
      form.setFieldValue("name", "Lin")
      form.setFieldValue("age", 30)
    })

    expect(observed).toEqual(["Ada", "Lin"])
    expect(values).toHaveBeenCalledTimes(2)
    expect(untracked).toHaveBeenCalledTimes(1)
    expect(getFormStateAdapterContext(form).store.state.values.value).toMatchObject({
      name: "Lin",
      age: 30,
    })
    form.destroy()
  })

  it("消费者独立取消，重订阅仍复用状态并取得最新值", () => {
    const form = createTestForm()

    const source = getFormStateAdapterContext(form).store.state.field("name").value

    const firstListener = vi.fn()

    const secondListener = vi.fn()

    const first = source.subscribe(firstListener)

    const second = source.subscribe(secondListener)

    first()
    first()
    form.setFieldValue("name", "Grace")
    expect(firstListener).toHaveBeenCalledTimes(1)
    expect(secondListener).toHaveBeenCalledTimes(2)
    second()
    form.setFieldValue("name", "Lin")
    expect(secondListener).toHaveBeenCalledTimes(2)
    const third = vi.fn()

    const stopThird = source.subscribe(third)

    expect(getFormStateAdapterContext(form).store.state.field("name").value).toBe(source)
    expect(third).toHaveBeenCalledExactlyOnceWith("Lin")
    stopThird()
    form.destroy()
  })

  it("同一回调可以独立订阅，监听器读取不会污染状态依赖", () => {
    const form = createTestForm()

    const source = getFormStateAdapterContext(form).store.state.field("name").errors

    const listener = vi.fn(() => {
      form.getFieldValue("age")
    })

    const first = source.subscribe(listener)

    const second = source.subscribe(listener)

    first()
    form.setFieldErrors("name", ["错误"])
    expect(listener).toHaveBeenCalledTimes(3)
    form.setFieldValue("age", 21)
    expect(listener).toHaveBeenCalledTimes(3)
    second()
    form.destroy()
  })

  it("Form 销毁停止所有订阅，禁止重新创建字段状态和订阅", () => {
    const form = createTestForm()

    const state = getFormStateAdapterContext(form).store.state

    const field = state.field("name")

    const listener = vi.fn()

    const allValues = vi.fn()

    const stop = field.value.subscribe(listener)

    state.values.subscribe(allValues)
    form.setFieldValue("name", "Grace")
    form.destroy()
    form.destroy()
    field.value.subscribe(listener)()
    stop()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(allValues).toHaveBeenCalledTimes(2)
    expect(form.getFieldsSnapshot()).toEqual({})
    expect(() => state.field("name")).toThrow("Store state has been destroyed")
  })

  it("聚合状态与提交状态直接由 Store / Model 更新", async () => {
    let finish: (() => void) | undefined

    const form = createForm({
      initialValues: { name: "Ada" },
      onFinish: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    })

    const touched = vi.fn()

    const pending = vi.fn()

    const loading = vi.fn()

    getFormStateAdapterContext(form).store.state.touchedFields.subscribe(touched)
    getFormStateAdapterContext(form).store.state.pendingFields.subscribe(pending)
    createFormStateAdapter(form).loading.subscribe(loading)
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true, "处理中")
    expect(getFormStateAdapterContext(form).store.state.touchedFields.value).toEqual([
      "name",
    ])
    expect(getFormStateAdapterContext(form).store.state.pendingFields.value).toEqual([
      { field: "name", message: ["处理中"] },
    ])
    form.reset()
    expect(getFormStateAdapterContext(form).store.state.touchedFields.value).toEqual([])
    expect(getFormStateAdapterContext(form).store.state.pendingFields.value).toEqual([])
    expect(touched).toHaveBeenCalledTimes(3)
    expect(pending).toHaveBeenCalledTimes(3)
    const submitted = form.submit()

    expect(form.isLoading()).toBe(true)
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"))
    finish?.()
    await submitted
    expect(form.isLoading()).toBe(false)
    expect(loading).toHaveBeenCalledTimes(2)
    form.destroy()
  })
})
