// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

let stepperAttrs: Record<string, unknown> = {}

vi.mock("vant", () => ({
  Stepper: defineComponent({
    name: "Stepper",
    inheritAttrs: false,
    props: ["modelValue", "disabled", "buttonSize"],
    emits: ["update:modelValue"],
    setup(props, { emit, attrs }) {
      return () => {
        stepperAttrs = attrs

        return h(
          "button",
          {
            onClick: () => emit("update:modelValue", 2),
            "data-button-size": props.buttonSize,
          },
          String(props.modelValue)
        )
      }
    },
  }),
}))

import StepperRenderer from "../index.vue"

describe("StepperRenderer", () => {
  it("readonly 状态使用 Wrapper 展示当前值且不渲染 Stepper", () => {
    const wrapper = mount(StepperRenderer, {
      props: {
        readonly: true,
        value: 5,
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxWrapper" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Stepper" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("只向 Stepper 透传组件相关属性", () => {
    const wrapper = mount(StepperRenderer, {
      props: {
        value: 1,
        buttonSize: "32px",
        readonlyPlaceholder: "-",
        onChange: vi.fn(),
        formItemProps: { name: "count" } as any,
        formInstance: {} as any,
      },
    })

    const stepper = wrapper.findComponent({ name: "Stepper" })

    expect(stepper.props("buttonSize")).toBe("32px")
    expect(stepperAttrs).not.toHaveProperty("readonlyPlaceholder")
    expect(stepperAttrs).not.toHaveProperty("onChange")
    expect(stepperAttrs).not.toHaveProperty("formItemProps")
    expect(stepperAttrs).not.toHaveProperty("formInstance")

    wrapper.unmount()
  })
})
