// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SelectorRenderer from "../index.vue"

describe("SelectorRenderer", () => {
  it("readonly 状态展示选中项文本且不渲染 Selector", () => {
    const wrapper = mount(SelectorRenderer, {
      props: {
        readonly: true,
        value: "college",
        options: [{ label: "大专", value: "college" }],
      },
    })

    expect(wrapper.text()).toContain("大专")
    expect(wrapper.findComponent({ name: "SSelector" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
