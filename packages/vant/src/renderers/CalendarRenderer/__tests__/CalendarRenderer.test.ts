// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Calendar: defineComponent({
    name: "Calendar",
    props: ["show", "class", "safeAreaInsetBottom", "teleport"],
    emits: ["confirm", "update:show"],
    setup(props) {
      return () => h("div", { class: props.class })
    },
  }),
  Cell: defineComponent({
    name: "Cell",
    props: ["value", "placeholder", "isLink", "clickable", "valueClass"],
    emits: ["click"],
    setup(props, { emit, slots }) {
      return () =>
        h(
          "div",
          { onClick: (event: MouseEvent) => emit("click", event) },
          slots.value?.() ?? slots.default?.() ?? props.value
        )
    },
  }),
}))

import CalendarRenderer from "../index.vue"

describe("CalendarRenderer", () => {
  it("未知 view 属性不切换为只读展示", async () => {
    const wrapper = mount(CalendarRenderer, {
      props: {
        view: true,
        value: "2026-06-12",
        format: "YYYY/MM/DD",
      } as any,
    })

    const cell = wrapper.findComponent({ name: "Cell" })

    expect(cell.text()).toContain("2026/06/12")
    expect(wrapper.findComponent({ name: "Calendar" }).exists()).toBe(true)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Calendar" }).props("show")).toBe(true)

    wrapper.unmount()
  })

  it("默认启用底部弹层安全区并挂载到 body", async () => {
    const wrapper = mount(CalendarRenderer)

    await wrapper.findComponent({ name: "Cell" }).vm.$emit("click")

    const calendar = wrapper.findComponent({ name: "Calendar" })

    expect(calendar.props("show")).toBe(true)
    expect(calendar.props("safeAreaInsetBottom")).toBe(true)
    expect(calendar.props("teleport")).toBe("body")
    expect(calendar.classes()).toContain("schemx-calendar-popup-renderer")

    wrapper.unmount()
  })
})
