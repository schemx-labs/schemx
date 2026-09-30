// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

let checkboxGroupAttrs: Record<string, unknown> = {}

vi.mock("vant", () => ({
  CheckboxGroup: defineComponent({
    name: "CheckboxGroup",
    inheritAttrs: false,
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(_, { attrs, slots }) {
      return () => {
        checkboxGroupAttrs = attrs

        return h("div", slots.default?.())
      }
    },
  }),
  Checkbox: defineComponent({
    name: "Checkbox",
    props: ["name", "disabled"],
    setup(_, { slots }) {
      return () => h("label", slots.default?.())
    },
  }),
}))

import CheckboxRenderer from "../index.vue"

describe("CheckboxRenderer", () => {
  it("readonly 状态展示选中项文本且不渲染 CheckboxGroup", () => {
    const wrapper = mount(CheckboxRenderer, {
      props: {
        readonly: true,
        value: ["reading", "music"],
        options: [
          { label: "阅读", value: "reading" },
          { label: "音乐", value: "music" },
        ],
      },
    })

    expect(wrapper.text()).toContain("阅读、音乐")
    expect(wrapper.findComponent({ name: "CheckboxGroup" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("只向 CheckboxGroup 透传组件相关属性", () => {
    const wrapper = mount(CheckboxRenderer, {
      props: {
        value: ["reading"],
        options: [{ label: "阅读", value: "reading" }],
        fieldNames: { label: "label", value: "value" },
        readonlyPlaceholder: "-",
        onChange: vi.fn(),
        formItemProps: { name: "hobbies" } as any,
        formInstance: {} as any,
      },
    })

    expect(checkboxGroupAttrs).not.toHaveProperty("options")
    expect(checkboxGroupAttrs).not.toHaveProperty("fieldNames")
    expect(checkboxGroupAttrs).not.toHaveProperty("readonlyPlaceholder")
    expect(checkboxGroupAttrs).not.toHaveProperty("onChange")
    expect(checkboxGroupAttrs).not.toHaveProperty("formItemProps")
    expect(checkboxGroupAttrs).not.toHaveProperty("formInstance")

    wrapper.unmount()
  })
})
