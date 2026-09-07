// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

let sliderAttrs: Record<string, unknown> = {}

vi.mock("vant", () => ({
  Slider: defineComponent({
    name: "Slider",
    inheritAttrs: false,
    props: ["modelValue", "disabled", "activeColor"],
    emits: ["update:modelValue"],
    setup(props, { emit, attrs }) {
      return () => {
        sliderAttrs = attrs

        return h(
          "button",
          {
            onClick: () => emit("update:modelValue", 50),
            "data-active-color": props.activeColor,
          },
          String(props.modelValue)
        )
      }
    },
  }),
}))

import SliderRenderer from "../index.vue"

describe("SliderRenderer", () => {
  it("readonly 状态使用 Wrapper 展示当前值且不渲染 Slider", () => {
    const wrapper = mount(SliderRenderer, {
      props: {
        readonly: true,
        value: 60,
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxWrapper" })

    expect(cell.exists()).toBe(true)
    expect(wrapper.findComponent({ name: "Slider" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("只向 Slider 透传组件相关属性", () => {
    const wrapper = mount(SliderRenderer, {
      props: {
        value: 20,
        activeColor: "#1989fa",
        readonlyPlaceholder: "-",
        onChange: vi.fn(),
        formItemProps: { name: "volume" } as any,
        formInstance: {} as any,
      },
    })

    const slider = wrapper.findComponent({ name: "Slider" })

    expect(slider.props("activeColor")).toBe("#1989fa")
    expect(sliderAttrs).not.toHaveProperty("readonlyPlaceholder")
    expect(sliderAttrs).not.toHaveProperty("onChange")
    expect(sliderAttrs).not.toHaveProperty("formItemProps")
    expect(sliderAttrs).not.toHaveProperty("formInstance")

    wrapper.unmount()
  })
})
