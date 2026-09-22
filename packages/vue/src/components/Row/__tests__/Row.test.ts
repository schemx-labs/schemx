// @vitest-environment happy-dom

import { h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Row from "../index"

describe("Row", () => {
  it("未注册组件时使用内置 Row 实现", () => {
    const wrapper = mount(Row, {
      props: { row: { gutter: 16, justify: "center", align: "middle" } },
      slots: { default: () => h("span", "内容") },
    })

    const row = wrapper.get(".schemx-row")

    expect(row.attributes("style")).toContain("--schemx-gutter-top: 8px")
    expect(row.attributes("style")).toContain("margin: -8px")
    expect(row.attributes("style")).toContain("justify-content: center")
    expect(row.attributes("style")).toContain("align-items: center")
    expect(row.text()).toBe("内容")
  })

  it("按 CSS padding shorthand 解析二元组和四元组 gutter", async () => {
    const wrapper = mount(Row, {
      props: { row: { gutter: [1, 2, 3, 4] } },
    })

    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-top: 0.5px"
    )
    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-left: 2px"
    )

    await wrapper.setProps({ row: { gutter: [5, 6] } })

    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-top: 2.5px"
    )
    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-right: 3px"
    )
  })
})
