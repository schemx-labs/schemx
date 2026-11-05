// @vitest-environment happy-dom

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vite-plus/test"

import Col from ".."

describe("Col", () => {
  it("未注册组件时使用内置 Col 实现", () => {
    const wrapper = mount(Col, {
      props: { col: { span: 12 } },
      slots: { default: () => h("span", { "data-testid": "content" }, "内容") },
    })

    expect(wrapper.find(".schemx-col").exists()).toBe(true)
    expect(wrapper.get(".schemx-col").attributes("style")).toContain("flex-basis: 50%")
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='test-col']").exists()).toBe(false)
  })

  it("auto 使用内容宽度并在运行时切回栅格，不重新挂载子节点", async () => {
    // 同一列在两种布局间切换时，子节点应保持身份。
    const wrapper = mount(Col, {
      props: { col: "auto" },
      attrs: { class: "business-col", "data-layout": "test" },
      slots: { default: () => h("input") },
    })

    // 初次挂载的输入节点。
    const input = wrapper.get("input").element

    expect(wrapper.get(".schemx-col").classes()).toContain("schemx-col--auto")
    expect(wrapper.get(".schemx-col").classes()).toContain("business-col")
    expect(wrapper.get(".schemx-col").attributes("auto")).toBeUndefined()
    await wrapper.setProps({ col: { span: 8, offset: 2 } })
    expect(wrapper.get("input").element).toBe(input)
    expect(wrapper.get(".schemx-col").classes()).not.toContain("schemx-col--auto")
    expect(wrapper.get(".schemx-col").attributes("style")).toContain("33.33333333333333%")
    await wrapper.setProps({ col: "auto" })
    expect(wrapper.get("input").element).toBe(input)
    expect(wrapper.get(".schemx-col").attributes("data-layout")).toBe("test")
    wrapper.unmount()
  })

  it("auto 继续调用自定义 Col 实现，透传类名并撤销栅格参数", () => {
    // 自定义列只需将 class、style 透传给实际布局节点。
    const CustomCol = defineComponent({
      props: { span: Number, offset: Number },
      // _props 是包装层归一化后的栅格参数，context 提供属性与子内容。
      setup(_props, context) {
        return () => h("section", context.attrs, context.slots.default?.())
      },
    })

    // 即使传入旧布局，auto 也完整替换旧 span 和 offset。
    const wrapper = mount(Col, {
      props: { col: "auto", layout: { span: 12, offset: 4 }, component: CustomCol },
    })

    expect(wrapper.get("section").classes()).toContain("schemx-col--auto")
    expect(wrapper.get("section").attributes("auto")).toBeUndefined()
    expect(wrapper.getComponent(CustomCol).props("span")).toBeUndefined()
    expect(wrapper.getComponent(CustomCol).props("offset")).toBeUndefined()
    wrapper.unmount()
  })

  it("block 覆盖 span 和 offset 并映射为满宽列", () => {
    const wrapper = mount(Col, {
      props: {
        col: { span: 6, offset: 4, block: true },
      },
    })

    expect(wrapper.get(".schemx-col").attributes("style")).toContain("flex-basis: 100%")
  })

  it("兼容旧 layout，并由 col 优先于 layout", () => {
    const wrapper = mount(Col, {
      props: {
        col: { span: 8 },
        layout: { span: 4 },
      },
    })

    expect(wrapper.get(".schemx-col").attributes("style")).toContain(
      "flex-basis: 33.33333333333333%"
    )
  })
})
