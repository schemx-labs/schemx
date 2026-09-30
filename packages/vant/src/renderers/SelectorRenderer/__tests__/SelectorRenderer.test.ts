// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vite-plus/test"

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

  it("只向 Selector 子组件透传需要的属性", () => {
    const wrapper = mount(SelectorRenderer, {
      props: {
        value: "college",
        options: [{ label: "大专", value: "college" }],
        fieldNames: { label: "label", value: "value" },
        readonlyPlaceholder: "-",
        formItemProps: { name: "education" } as any,
        formInstance: {} as any,
      },
    })

    const selector = wrapper.findComponent({ name: "SSelector" })

    expect(selector.props("options")).toHaveLength(1)
    expect(selector.props("fieldNames")).toEqual({ label: "label", value: "value" })
    expect(selector.attributes("readonly-placeholder")).toBeUndefined()
    expect(selector.attributes("form-item-props")).toBeUndefined()
    expect(selector.attributes("form-instance")).toBeUndefined()

    wrapper.unmount()
  })
})
