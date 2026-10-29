/**
 * useWatch 与 Vue Instance 兼容测试。
 *
 * @module hooks/__tests__/useWatch
 */

import { defineComponent, effectScope, h } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import { useWatch } from ".."
import { getFormStateAdapterContext } from "../../../../core/src/adapter/formStateAdapter/context"
import { createFormContext, provideFormContextState } from "../../context"

describe("useWatch", () => {
  it("通过 Instance Context 仍使用原始 Core 订阅语义", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const values: Array<string | undefined> = []

    const Child = defineComponent({
      setup() {
        useWatch<{ name: string }>("name", (_snapshot, payload) => {
          values.push(payload.value)
        })

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(form)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    form.setFieldValue("name", "Grace")

    expect(values).toEqual(["Grace"])

    wrapper.unmount()

    form.setFieldValue("name", "Lin")

    expect(values).toEqual(["Grace"])

    form.destroy()
  })

  it("嵌套 scope 停止时取消三种监听，原生实例不创建 Vue 状态订阅", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const subscribe = vi.spyOn(
      getFormStateAdapterContext(form).store.state.values,
      "subscribe"
    )

    const all = vi.fn()

    const field = vi.fn()

    const fields = vi.fn()

    let stop = () => {}

    const Child = defineComponent({
      setup() {
        const scope = effectScope()

        scope.run(() => {
          useWatch<{ name: string }>(all, { immediate: true })
          useWatch<{ name: string }>("name", field, { immediate: true })
          useWatch<{ name: string }>(["name"], fields, { immediate: true })
        })

        stop = () => scope.stop()

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        provideFormContextState({ form })

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    form.setFieldValue("name", "Grace")

    expect(all).toHaveBeenCalledTimes(2)
    expect(field).toHaveBeenCalledTimes(2)
    expect(fields).toHaveBeenCalledTimes(2)
    expect(subscribe).not.toHaveBeenCalled()

    stop()
    stop()
    form.setFieldValue("name", "Lin")

    expect(all).toHaveBeenCalledTimes(2)
    expect(field).toHaveBeenCalledTimes(2)
    expect(fields).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    form.destroy()
  })

  it("immediate 回调同步停止 scope 时也会释放订阅", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const callback = vi.fn()

    const Child = defineComponent({
      setup() {
        const scope = effectScope()

        scope.run(() => {
          useWatch<{ name: string }>(
            "name",
            () => {
              callback()
              scope.stop()
            },
            { immediate: true }
          )
        })

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(form)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    form.setFieldValue("name", "Grace")

    expect(callback).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    form.destroy()
  })

  it("没有活动 scope 时直接拒绝订阅", () => {
    expect(() => useWatch(() => {})).toThrow("requires an active Vue scope")
  })
})
