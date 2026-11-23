// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Rate: defineComponent({
    name: "Rate",
    props: {
      modelValue: Number,
      readonly: Boolean,
      disabled: Boolean,
    },
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 3) }, String(props.modelValue))
    },
  }),
}))

import RateRenderer from "../index.vue"

describe("RateRenderer", () => {
  it("readonly 状态渲染 Rate 且 handleChange 不触发 onChange", async () => {
    const onChange = vi.fn()
    const wrapper = mount(RateRenderer, {
      props: {
        readonly: true,
        value: 4,
        onChange,
      },
    })

    const rate = wrapper.findComponent({ name: "Rate" })

    expect(rate.exists()).toBe(true)
    await rate.vm.$emit("update:modelValue", 3)
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
