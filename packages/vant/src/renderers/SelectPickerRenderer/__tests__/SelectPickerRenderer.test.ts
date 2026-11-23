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
      setup(_props, { slots }) {
        return () => h("div", slots.default?.())
      },
    })

  return {
    Button: component("Button", ["type", "size"], ["click"]),
    Cell: component(
      "Cell",
      ["value", "placeholder", "isLink", "clickable", "disabled", "valueAlign"],
      ["click"]
    ),
    Checkbox: component("Checkbox", ["name", "disabled"]),
    CheckboxGroup: component("CheckboxGroup", ["modelValue"], ["update:modelValue"]),
    Popup: component("Popup", ["show"], ["update:show"]),
    Radio: component("Radio", ["name", "disabled"]),
    RadioGroup: component("RadioGroup", ["modelValue"], ["update:modelValue"]),
  }
})

import SelectPickerRenderer from "../index.vue"

describe("SelectPickerRenderer", () => {
  it("默认使用多选模式并展示 Cell", () => {
    const wrapper = mount(SelectPickerRenderer)

    expect(wrapper.findComponent({ name: "SchemxCell" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "CheckboxGroup" }).exists()).toBe(false)

    wrapper.unmount()
  })

  it("点击 Cell 后打开弹窗并渲染多选项", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        options: [{ label: "选项 A", value: "a" }],
      },
    })

    await wrapper.findComponent({ name: "SchemxCell" }).vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).props("show")).toBe(true)
    expect(wrapper.findComponent({ name: "CheckboxGroup" }).exists()).toBe(true)

    wrapper.unmount()
  })

  it("将确认按钮展示在选项列表底部", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        options: [{ label: "选项 A", value: "a" }],
      },
    })

    await wrapper.findComponent({ name: "SchemxCell" }).vm.$emit("click")

    const options = wrapper.get(".schemx-select-picker-options")
    const footer = options.element.nextElementSibling

    expect(footer?.classList.contains("schemx-select-picker-footer")).toBe(true)
    expect(
      wrapper
        .find(".schemx-select-picker-footer")
        .findComponent({ name: "Button" })
        .exists()
    ).toBe(true)

    wrapper.unmount()
  })

  it("确认选择后桥接 Schemx 的 value 更新契约", async () => {
    const onChange = vi.fn()
    const onConfirm = vi.fn()
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        value: [],
        options: [{ label: "选项 A", value: "a" }],
        onChange,
        onConfirm,
      },
    })

    await wrapper.findComponent({ name: "SchemxCell" }).vm.$emit("click")
    await wrapper
      .findComponent({ name: "CheckboxGroup" })
      .vm.$emit("update:modelValue", ["a"])
    await wrapper.findComponent({ name: "Button" }).vm.$emit("click")

    expect(onChange).toHaveBeenCalledWith(["a"], {
      value: ["a"],
      selectedItems: [{ label: "选项 A", value: "a" }],
    })
    expect(onConfirm).toHaveBeenCalledWith(["a"], {
      value: ["a"],
      selectedItems: [{ label: "选项 A", value: "a" }],
    })
    expect(wrapper.emitted("update:value")?.[0]).toEqual([["a"]])

    wrapper.unmount()
  })

  it("view 状态展示选项文本且不渲染弹窗", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        view: true,
        value: ["a"],
        options: [{ label: "选项 A", value: "a" }],
      },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.get(".schemx-cell__value").text()).toBe("选项 A")
    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
