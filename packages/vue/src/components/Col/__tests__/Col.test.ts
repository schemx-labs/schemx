// @vitest-environment happy-dom

import { h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Col from "../index"

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
