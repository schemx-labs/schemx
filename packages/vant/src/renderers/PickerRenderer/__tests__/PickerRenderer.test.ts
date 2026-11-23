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
    Picker: component("Picker", ["modelValue", "columns", "columnsFieldNames"]),
    Popup: component("Popup", ["show"], ["update:show"]),
  }
})

import PickerRenderer from "../index.vue"

describe("PickerRenderer", () => {
  it("readonly 状态显示格式化 label，不渲染弹窗，点击不打开", async () => {
    const wrapper = mount(PickerRenderer, {
      props: {
        readonly: true,
        value: "gz",
        options: [{ text: "广州", value: "gz" }],
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.exists()).toBe(true)
    expect(cell.get(".schemx-cell__value").text()).toBe("广州")
    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
