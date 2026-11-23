// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import TextRenderer from "../index.vue"

describe("TextRenderer", () => {
  it("非 view 状态引用底层 SchemxInput 组件", () => {
    const wrapper = mount(TextRenderer, {
      props: {
        value: "文本内容",
      },
    })

    expect(wrapper.findComponent({ name: "SchemxInput" }).exists()).toBe(true)
    expect(wrapper.find("input").exists()).toBe(true)

    wrapper.unmount()
  })

  it("readonly 状态只渲染详情文本，不渲染底层输入组件", () => {
    const wrapper = mount(TextRenderer, {
      props: {
        readonly: true,
        value: "文本详情",
        clearable: true,
        rightIcon: "arrow",
      },
    })

    expect(wrapper.findComponent({ name: "SchemxInput" }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: "SchemxCell" }).exists()).toBe(true)
    expect(wrapper.find("input").exists()).toBe(false)

    wrapper.unmount()
  })
})
