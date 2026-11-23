// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names, vue/no-reserved-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Switch: defineComponent({
    name: "Switch",
    props: ["modelValue", "disabled", "loading"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", !props.modelValue) })
    },
  }),
}))

import SwitchRenderer from "../index.vue"

describe("SwitchRenderer", () => {
  it("readonly 状态使用 Cell 展示开关文本且不渲染 Switch", async () => {
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

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Switch" }).exists()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
