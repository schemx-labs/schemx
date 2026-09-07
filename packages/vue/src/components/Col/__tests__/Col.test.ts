import { type Component, defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it } from "vitest"

import { registerCol, registeredColComponent } from "../../../utils/colProvider"
import Col from "../index"

const TestCol = defineComponent({
  name: "TestCol",
  props: {
    span: Number,
    offset: Number,
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        "div",
        {
          ...attrs,
          "data-testid": "test-col",
          "data-span": String(props.span),
          "data-offset": String(props.offset),
        },
        slots.default?.()
      )
  },
})

const GlobalCol = defineComponent({
  name: "GlobalCol",
  setup(_, { slots }) {
    return () => h("div", { "data-testid": "global-col" }, slots.default?.())
  },
})

afterEach(() => {
  registeredColComponent.value = undefined
})

describe("Col", () => {
  it("未注册组件时保持透明渲染", () => {
    const wrapper = mount(Col, {
      props: { layout: { span: 12 } },
      slots: { default: () => h("span", { "data-testid": "content" }, "内容") },
    })

    expect(wrapper.find("[data-testid='content']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='test-col']").exists()).toBe(false)
  })

  it("将 layout 的 span 和 offset 传给注册组件", () => {
    registerCol(TestCol)

    const wrapper = mount(Col, {
      props: { layout: { span: 12, offset: 2 } },
      slots: { default: () => h("span", { "data-testid": "content" }, "内容") },
    })

    const col = wrapper.get("[data-testid='test-col']")

    expect(col.attributes("data-span")).toBe("12")
    expect(col.attributes("data-offset")).toBe("2")
    expect(col.find("[data-testid='content']").exists()).toBe(true)
  })

  it("block 覆盖 span 和 offset 并映射为满宽列", () => {
    const component: Component = TestCol

    const wrapper = mount(Col, {
      props: {
        component,
        layout: { span: 6, offset: 4, block: true },
      },
    })

    const col = wrapper.get("[data-testid='test-col']")

    expect(col.attributes("data-span")).toBe("24")
    expect(col.attributes("data-offset")).toBe("0")
    expect(col.attributes("fullline")).toBeUndefined()
  })

  it("Col 显式 component 优先于全局注册", () => {
    registerCol(GlobalCol)

    const wrapper = mount(Col, {
      props: { component: TestCol },
    })

    expect(wrapper.find("[data-testid='test-col']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='global-col']").exists()).toBe(false)
  })
})
