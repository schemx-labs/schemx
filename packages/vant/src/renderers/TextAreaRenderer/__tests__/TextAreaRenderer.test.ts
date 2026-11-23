// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import TextAreaRenderer from "../index.vue"

describe("TextAreaRenderer", () => {
  it("非 view 状态引用底层 SchemxInput 组件", () => {
    const wrapper = mount(TextAreaRenderer, {
      props: {
        value: "多行内容",
      },
    })

    expect(wrapper.findComponent({ name: "SchemxInput" }).exists()).toBe(true)
    expect(wrapper.find("textarea").exists()).toBe(true)

    wrapper.unmount()
  })

  it("readonly 状态只渲染详情文本，不渲染底层输入组件", () => {
    const wrapper = mount(TextAreaRenderer, {
      props: {
        readonly: true,
        value: "多行详情",
        showWordLimit: true,
        maxlength: 20,
      },
    })

    expect(wrapper.findComponent({ name: "SchemxInput" }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: "SchemxCell" }).exists()).toBe(true)
    expect(wrapper.find("textarea").exists()).toBe(false)

    wrapper.unmount()
  })
})
