// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SchemxForm from "../index"

describe("Vant Col layout adapter", () => {
  it("导入 Vant 适配包后使用 VanCol 渲染 Schema layout", () => {
    const wrapper = mount(SchemxForm, {
      props: {
        initialValues: { first: "A", second: "B" },
        schemas: [
          {
            name: "first",
            label: "第一项",
            componentType: "input",
            layout: { span: 12, offset: 2 },
          },
          {
            name: "second",
            label: "第二项",
            componentType: "input",
            layout: { span: 6, block: true },
          },
        ],
      },
    })

    expect(wrapper.find(".schemx-row").exists()).toBe(true)
    expect(wrapper.find(".van-col--12").exists()).toBe(true)
    expect(wrapper.find(".van-col--offset-2").exists()).toBe(true)
    expect(wrapper.find(".van-col--24").exists()).toBe(true)
    expect(wrapper.find("[fullline]").exists()).toBe(false)

    wrapper.unmount()
  })
})
