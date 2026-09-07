// @vitest-environment happy-dom

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => {
  const component = (name: string, props: string[], emits: string[] = []) =>
    defineComponent({
      name,
      props,
      emits,
      setup(props, { emit, slots }) {
        return () =>
          h(
            "div",
            {
              onClick: (event: MouseEvent) => emit("click", event),
            },
            slots.value?.() ?? slots.default?.() ?? String((props as any).value ?? "")
          )
      },
    })

  return {
    Cell: component(
      "Cell",
      ["value", "placeholder", "isLink", "clickable", "valueClass"],
      ["click"]
    ),
    DatePicker: component("DatePicker", ["modelValue"]),
    Popup: component("Popup", ["show"], ["update:show"]),
  }
})

import DateRenderer from "../index.vue"

describe("DateRenderer", () => {
  it("readonly 状态展示格式化日期且不渲染弹窗", async () => {
    const wrapper = mount(DateRenderer, {
      props: {
        readonly: true,
        value: "2026-06-11",
        format: "YYYY/MM/DD",
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxWrapper" })

    expect(cell.text()).toContain("2026/06/11")
    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("支持使用 format 函数返回日期格式", () => {
    const wrapper = mount(DateRenderer, {
      props: {
        readonly: true,
        value: "2026-06-11",
        format: () => "DD/MM/YYYY",
      },
    })

    expect(wrapper.findComponent({ name: "SchemxWrapper" }).text()).toContain(
      "11/06/2026"
    )

    wrapper.unmount()
  })
})
