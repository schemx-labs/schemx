// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names, vue/no-reserved-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Switch: defineComponent({
    name: "Switch",
    props: ["modelValue", "disabled", "loading", "activeColor"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", !props.modelValue) })
    },
  }),
}))

import SwitchRenderer from "../index.vue"

describe("SwitchRenderer", () => {
  it("readonly 状态使用 Wrapper 展示开关文本且不渲染 Switch", async () => {
    const onChange = vi.fn()

    const wrapper = mount(SwitchRenderer, {
      props: {
        readonly: true,
        value: true,
        activeText: "开启",
        inactiveText: "关闭",
        onChange,
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxWrapper" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Switch" }).exists()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("把 Switch 原生属性从 props 透传给子组件", () => {
    const wrapper = mount(SwitchRenderer, {
      props: {
        value: true,
        activeColor: "#07c160",
        readonlyPlaceholder: "-",
        formItemProps: { name: "enabled" } as any,
        formInstance: {} as any,
      },
    })

    const switchComponent = wrapper.findComponent({ name: "Switch" })

    expect(switchComponent.props("activeColor")).toBe("#07c160")
    expect(switchComponent.attributes("readonly-placeholder")).toBeUndefined()
    expect(switchComponent.attributes("form-item-props")).toBeUndefined()
    expect(switchComponent.attributes("form-instance")).toBeUndefined()

    wrapper.unmount()
  })
})
