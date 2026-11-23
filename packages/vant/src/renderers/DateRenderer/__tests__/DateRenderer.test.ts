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
            slots.default?.() ?? String((props as any).value ?? "")
          )
      },
    })

  return {
    Cell: component(
      "Cell",
      ["value", "placeholder", "isLink", "clickable", "disabled", "valueAlign"],
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

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.get(".schemx-cell__value").text()).toBe("2026/06/11")
    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
