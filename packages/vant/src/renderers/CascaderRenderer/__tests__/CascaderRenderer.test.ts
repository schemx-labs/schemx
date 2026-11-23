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
    Cascader: component("Cascader", ["modelValue", "options", "fieldNames"]),
    Cell: component(
      "Cell",
      ["value", "placeholder", "isLink", "clickable", "disabled", "valueAlign"],
      ["click"]
    ),
    Popup: component("Popup", ["show"], ["update:show"]),
  }
})

import CascaderRenderer from "../index.vue"

describe("CascaderRenderer", () => {
  it("readonly 状态展示级联 label 且不渲染弹窗", async () => {
    const wrapper = mount(CascaderRenderer, {
      props: {
        readonly: true,
        value: ["gd", "gz"],
        options: [
          {
            label: "广东",
            value: "gd",
            children: [{ label: "广州", value: "gz" }],
          },
        ],
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.get(".schemx-cell__value").text()).toBe("广东 - 广州")
    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
