// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Slider: defineComponent({
    name: "Slider",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 50) }, String(props.modelValue))
    },
  }),
}))

import SliderRenderer from "../index.vue"

describe("SliderRenderer", () => {
  it("readonly 状态使用 Cell 展示当前值且不渲染 Slider", () => {
    const wrapper = mount(SliderRenderer, {
      props: {
        readonly: true,
        value: 60,
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Slider" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
