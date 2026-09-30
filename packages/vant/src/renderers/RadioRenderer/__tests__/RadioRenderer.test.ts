// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

let radioGroupAttrs: Record<string, unknown> = {}

vi.mock("vant", () => ({
  RadioGroup: defineComponent({
    name: "RadioGroup",
    inheritAttrs: false,
    props: ["modelValue"],
    emits: ["update:modelValue"],
    setup(_, { attrs, slots }) {
      return () => {
        radioGroupAttrs = attrs

        return h("div", slots.default?.())
      }
    },
  }),
  Radio: defineComponent({
    name: "Radio",
    props: ["name", "disabled"],
    setup(_, { slots }) {
      return () => h("label", slots.default?.())
    },
  }),
}))

import RadioRenderer from "../index.vue"

describe("RadioRenderer", () => {
  it("readonly 状态展示选中项文本且不渲染 RadioGroup", () => {
    const wrapper = mount(RadioRenderer, {
      props: {
        readonly: true,
        value: "female",
        options: [{ label: "女", value: "female" }],
      },
    })

    expect(wrapper.text()).toContain("女")
    expect(wrapper.findComponent({ name: "RadioGroup" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("只向 RadioGroup 透传组件相关属性", () => {
    const wrapper = mount(RadioRenderer, {
      props: {
        value: "female",
        options: [{ label: "女", value: "female" }],
        fieldNames: { label: "label", value: "value" },
        readonlyPlaceholder: "-",
        onChange: vi.fn(),
        formItemProps: { name: "gender" } as any,
        formInstance: {} as any,
      },
    })

    expect(radioGroupAttrs).not.toHaveProperty("options")
    expect(radioGroupAttrs).not.toHaveProperty("fieldNames")
    expect(radioGroupAttrs).not.toHaveProperty("readonlyPlaceholder")
    expect(radioGroupAttrs).not.toHaveProperty("onChange")
    expect(radioGroupAttrs).not.toHaveProperty("formItemProps")
    expect(radioGroupAttrs).not.toHaveProperty("formInstance")

    wrapper.unmount()
  })
})
