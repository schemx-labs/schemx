// @vitest-environment happy-dom

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

let checkboxAttrs: Record<string, unknown> = {}

let popupAttrs: Record<string, unknown> = {}

let radioAttrs: Record<string, unknown> = {}

vi.mock("vant", () => {
  const component = (name: string, props: string[], emits: string[] = []) =>
    defineComponent({
      name,
      inheritAttrs: false,
      props,
      emits,
      setup(_props, { attrs, slots }) {
        return () => {
          if (name === "Checkbox") checkboxAttrs = attrs
          if (name === "Popup") popupAttrs = attrs
          if (name === "Radio") radioAttrs = attrs

          return h("div", slots.default?.())
        }
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
    Popup: component("Popup", ["show", "zIndex"], ["update:show"]),
    Radio: component("Radio", ["name", "disabled"]),
    RadioGroup: component("RadioGroup", ["modelValue"], ["update:modelValue"]),
  }
})

import SelectPickerRenderer from "../index.vue"

describe("SelectPickerRenderer", () => {
  it("默认使用多选模式并将 contentAlign 下发给 Cell", () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: { contentAlign: "center" },
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.exists()).toBe(true)
    expect(cell.props("align")).toBe("center")
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

  it("未知 view 属性不切换为只读展示", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        view: true,
        value: ["a"],
        options: [{ label: "选项 A", value: "a" }],
      } as any,
    })

    const cell = wrapper.findComponent({ name: "SchemxCell" })

    expect(cell.get(".schemx-cell__value").text()).toBe("选项 A")
    expect(wrapper.findComponent({ name: "Popup" }).props("show")).toBe(false)

    await cell.vm.$emit("click")

    expect(wrapper.findComponent({ name: "Popup" }).exists()).toBe(true)

    wrapper.unmount()
  })

  it("过滤 Popup 和 Checkbox 子组件无关属性", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        value: [],
        options: [
          {
            label: "选项 A",
            value: "a",
            disabled: false,
            iconSize: "18px",
          },
        ],
        popupProps: {
          zIndex: 3000,
          show: false,
        } as any,
        formItemProps: { name: "tags" } as any,
        formInstance: {} as any,
      },
    })

    await wrapper.findComponent({ name: "SchemxCell" }).vm.$emit("click")

    expect(popupAttrs).not.toHaveProperty("show")
    expect(popupAttrs).not.toHaveProperty("formItemProps")
    expect(popupAttrs).not.toHaveProperty("formInstance")
    expect(wrapper.findComponent({ name: "Popup" }).props("zIndex")).toBe(3000)
    expect(checkboxAttrs).not.toHaveProperty("label")
    expect(checkboxAttrs).not.toHaveProperty("value")
    expect(checkboxAttrs).not.toHaveProperty("disabled")
    expect(checkboxAttrs).toHaveProperty("iconSize", "18px")

    wrapper.unmount()
  })

  it("过滤 Radio 选项数据字段", async () => {
    const wrapper = mount(SelectPickerRenderer, {
      props: {
        type: "radio",
        value: "a",
        options: [
          {
            label: "选项 A",
            value: "a",
            disabled: false,
            iconSize: "18px",
          },
        ],
      },
    })

    await wrapper.findComponent({ name: "SchemxCell" }).vm.$emit("click")

    expect(radioAttrs).not.toHaveProperty("label")
    expect(radioAttrs).not.toHaveProperty("value")
    expect(radioAttrs).not.toHaveProperty("disabled")
    expect(radioAttrs).toHaveProperty("iconSize", "18px")

    wrapper.unmount()
  })
})
