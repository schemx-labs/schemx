// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  CheckboxGroup: defineComponent({
    name: "CheckboxGroup",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(_, { slots }) {
      return () => h("div", slots.default?.())
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
})
