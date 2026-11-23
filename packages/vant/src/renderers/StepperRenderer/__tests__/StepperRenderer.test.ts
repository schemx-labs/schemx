// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Stepper: defineComponent({
    name: "Stepper",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 2) }, String(props.modelValue))
    },
  }),
}))

import StepperRenderer from "../index.vue"

describe("StepperRenderer", () => {
  it("readonly 状态使用 Cell 展示当前值且不渲染 Stepper", () => {
    const wrapper = mount(StepperRenderer, {
      props: {
        readonly: true,
        value: 5,
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Stepper" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
