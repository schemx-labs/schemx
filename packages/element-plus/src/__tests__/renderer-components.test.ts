// @vitest-environment happy-dom

import { type Component, defineComponent, h, nextTick } from "vue"

import { mount } from "@vue/test-utils"
import { ElMessage } from "element-plus"
import { describe, expect, it, vi } from "vitest"

import AutocompleteRenderer from "../renderers/AutocompleteRenderer/index.vue"
import CascaderRendererComponent from "../renderers/CascaderRenderer/index.vue"
import CheckboxRendererComponent from "../renderers/CheckboxRenderer/index.vue"
import ColorPickerRenderer from "../renderers/ColorPickerRenderer/index.vue"
import DatePickerRenderer from "../renderers/DatePickerRenderer/index.vue"
import DateTimePickerRenderer from "../renderers/DateTimePickerRenderer/index.vue"
import InputNumberRenderer from "../renderers/InputNumberRenderer/index.vue"
import InputOtpRenderer from "../renderers/InputOtpRenderer/index.vue"
import InputTagRenderer from "../renderers/InputTagRenderer/index.vue"
import MentionRenderer from "../renderers/MentionRenderer/index.vue"
import RadioRendererComponent from "../renderers/RadioRenderer/index.vue"
import RateRenderer from "../renderers/RateRenderer/index.vue"
import SelectRenderer from "../renderers/SelectRenderer/index.vue"
import SliderRenderer from "../renderers/SliderRenderer/index.vue"
import SwitchRenderer from "../renderers/SwitchRenderer/index.vue"
import TimePickerRenderer from "../renderers/TimePickerRenderer/index.vue"
import TimeSelectRenderer from "../renderers/TimeSelectRenderer/index.vue"
import TreeSelectRenderer from "../renderers/TreeSelectRenderer/index.vue"
import UploadRenderer from "../renderers/UploadRenderer/index.vue"
import VirtualizedSelectRenderer from "../renderers/VirtualizedSelectRenderer/index.vue"

function modelStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: [
      "modelValue",
      "value",
      "disabled",
      "options",
      "data",
      "loading",
      "props",
      "nodeKey",
      "valueKey",
      "fileList",
      "showFileList",
      "indeterminate",
      "border",
      "name",
      "label",
      "fill",
      "textColor",
      "type",
      "min",
      "max",
      "accept",
      "beforeUpload",
    ],
    emits: [
      "update:modelValue",
      "update:fileList",
      "blur",
      "focus",
      "clear",
      "finish",
      "select",
      "add-tag",
      "remove-tag",
    ],
    setup(_props, { slots }) {
      return () => h("div", slots.default?.())
    },
  })
}

function stubs() {
  return {
    ElInput: modelStub("ElInput"),
    ElInputNumber: modelStub("ElInputNumber"),
    ElAutocomplete: modelStub("ElAutocomplete"),
    ElColorPicker: modelStub("ElColorPicker"),
    ElDatePicker: modelStub("ElDatePicker"),
    ElInputTag: modelStub("ElInputTag"),
    ElInputOtp: modelStub("ElInputOtp"),
    ElMention: modelStub("ElMention"),
    ElSelect: modelStub("ElSelect"),
    ElSelectV2: modelStub("ElSelectV2"),
    ElTimePicker: modelStub("ElTimePicker"),
    ElTimeSelect: modelStub("ElTimeSelect"),
    ElTreeSelect: modelStub("ElTreeSelect"),
    ElSwitch: modelStub("ElSwitch"),
    ElRadioGroup: modelStub("ElRadioGroup"),
    ElRadio: modelStub("ElRadio"),
    ElCheckboxGroup: modelStub("ElCheckboxGroup"),
    ElCheckbox: modelStub("ElCheckbox"),
    ElCascader: modelStub("ElCascader"),
    ElRate: modelStub("ElRate"),
    ElSlider: modelStub("ElSlider"),
    ElUpload: modelStub("ElUpload"),
    ElImage: defineComponent({
      name: "ElImage",
      props: ["src", "previewSrcList"],
      setup() {
        return () => h("img")
      },
    }),
    ElButton: defineComponent({
      name: "ElButton",
      setup(_, { slots }) {
        return () => h("button", slots.default?.())
      },
    }),
    ElIcon: defineComponent({
      name: "ElIcon",
      setup(_, { slots }) {
        return () => h("span", slots.default?.())
      },
    }),
  }
}

function mountRenderer(component: Component, props: Record<string, unknown> = {}) {
  return mount(component, {
    props,
    global: { stubs: stubs() },
  })
}

describe("Element Plus Renderer components", () => {
  it.each([
    [AutocompleteRenderer, "ElAutocomplete", "next"],
    [ColorPickerRenderer, "ElColorPicker", "#409eff"],
    [DateTimePickerRenderer, "ElDatePicker", "2026-01-01 10:00:00"],
    [InputTagRenderer, "ElInputTag", ["one", "two"]],
    [InputOtpRenderer, "ElInputOtp", "123456"],
    [MentionRenderer, "ElMention", "@Ada"],
    [InputNumberRenderer, "ElInputNumber", 8],
    [SelectRenderer, "ElSelect", "a"],
    [VirtualizedSelectRenderer, "ElSelectV2", "a"],
    [SwitchRenderer, "ElSwitch", "enabled"],
    [DatePickerRenderer, "ElDatePicker", "2026-01-01"],
    [TimePickerRenderer, "ElTimePicker", "10:00:00"],
    [TimeSelectRenderer, "ElTimeSelect", "10:00"],
    [TreeSelectRenderer, "ElTreeSelect", "a"],
    [RateRenderer, "ElRate", 4],
    [SliderRenderer, "ElSlider", 50],
  ])("bridges %s model updates to Schemx", async (component, childName, value) => {
    const onChange = vi.fn()

    const wrapper = mountRenderer(component, { onChange })

    wrapper.findComponent({ name: childName }).vm.$emit("update:modelValue", value)
    await nextTick()

    expect(onChange).toHaveBeenCalledWith(value)
    expect(wrapper.emitted("update:value")).toEqual([[value]])
  })

  it("maps Radio and Checkbox options to Element Plus controls", () => {
    const radio = mountRenderer(RadioRendererComponent, {
      options: [{ label: "A", value: "a" }],
    })

    const checkbox = mountRenderer(CheckboxRendererComponent, {
      options: [{ label: "A", value: "a" }],
    })

    expect(radio.findComponent({ name: "ElRadio" }).props("value")).toBe("a")
    expect(checkbox.findComponent({ name: "ElCheckbox" }).props("value")).toBe("a")
  })

  it("forwards group and option component props for Radio and Checkbox", () => {
    const radio = mountRenderer(RadioRendererComponent, {
      fill: "#409eff",
      type: "button",
      options: [{ label: "A", value: "a", border: true, name: "choice" }],
    })

    const checkbox = mountRenderer(CheckboxRendererComponent, {
      fill: "#409eff",
      max: 1,
      options: [{ label: "A", value: "a", border: true, indeterminate: true }],
    })

    expect(radio.findComponent({ name: "ElRadioGroup" }).props()).toMatchObject({
      fill: "#409eff",
      type: "button",
    })
    expect(radio.findComponent({ name: "ElRadio" }).props()).toMatchObject({
      border: true,
      name: "choice",
      label: "A",
      value: "a",
    })
    expect(checkbox.findComponent({ name: "ElCheckboxGroup" }).props()).toMatchObject({
      fill: "#409eff",
      max: 1,
    })
    expect(checkbox.findComponent({ name: "ElCheckbox" }).props()).toMatchObject({
      border: true,
      indeterminate: true,
      label: "A",
      value: "a",
    })
  })

  it("passes Cascader props mappings to Element Plus", () => {
    const wrapper = mountRenderer(CascaderRendererComponent, {
      options: [{ text: "A", id: "a" }],
      props: { label: "text", value: "id" },
    })

    expect(wrapper.findComponent({ name: "ElCascader" }).props("options")).toEqual([
      { text: "A", id: "a" },
    ])
    expect(wrapper.findComponent({ name: "ElCascader" }).props("modelValue")).toBeNull()
  })

  it("maps Select options and displays the selected label in readonly mode", () => {
    const wrapper = mountRenderer(SelectRenderer, {
      options: [{ text: "Alpha", id: "a" }],
      props: { label: "text", value: "id" },
      value: "a",
      readonly: true,
    })

    expect(wrapper.text()).toContain("Alpha")
  })

  it("maps TreeSelect options to data and props mappings", () => {
    const wrapper = mountRenderer(TreeSelectRenderer, {
      options: [{ title: "Root", key: "root", children: [] }],
      props: { label: "title", children: "children" },
      nodeKey: "key",
      valueKey: "key",
    })

    const treeSelect = wrapper.findComponent({ name: "ElTreeSelect" })

    expect(treeSelect.props("data")).toEqual([
      { title: "Root", key: "root", children: [] },
    ])
    expect(treeSelect.props("nodeKey")).toBe("key")
    expect(treeSelect.props("valueKey")).toBe("key")
    expect(treeSelect.props("props")).toMatchObject({
      label: "title",
      children: "children",
    })
  })

  it("forwards key events from input-like Renderers", () => {
    const onFinish = vi.fn()

    const onSelect = vi.fn()

    const otp = mountRenderer(InputOtpRenderer, { onFinish })

    const autocomplete = mountRenderer(AutocompleteRenderer, { onSelect })

    otp.findComponent({ name: "ElInputOtp" }).vm.$emit("finish", "123456")
    autocomplete.findComponent({ name: "ElAutocomplete" }).vm.$emit("select", {
      label: "Ada",
      value: "ada",
    })

    expect(onFinish).toHaveBeenCalledWith("123456")
    expect(onSelect).toHaveBeenCalledWith({ label: "Ada", value: "ada" })
  })

  it("does not update a disabled Renderer", () => {
    const onChange = vi.fn()

    const wrapper = mountRenderer(InputTagRenderer, {
      disabled: true,
      onChange,
    })

    wrapper
      .findComponent({ name: "ElInputTag" })
      .vm.$emit("update:modelValue", ["blocked"])

    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders Upload read-only files with Element Plus Image", () => {
    const wrapper = mountRenderer(UploadRenderer, {
      readonly: true,
      value: [{ name: "avatar.png", url: "/avatar.png" }],
    })

    expect(wrapper.findComponent({ name: "ElImage" }).props("src")).toBe("/avatar.png")
    expect(wrapper.findComponent({ name: "ElUpload" }).exists()).toBe(false)
  })

  it("强制校验 Upload accept 文件类型", () => {
    const beforeUpload = vi.fn().mockReturnValue(true)

    const warning = vi.spyOn(ElMessage, "warning").mockReturnValue({ close: vi.fn() })

    const wrapper = mountRenderer(UploadRenderer, {
      accept: ".png,image/jpeg",
      beforeUpload,
    })

    const upload = wrapper.findComponent({ name: "ElUpload" })

    const validate = upload.props("beforeUpload")

    const invalidFile = Object.assign(
      new File(["pdf"], "report.pdf", { type: "application/pdf" }),
      { uid: 1 }
    )

    const validFile = Object.assign(
      new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      { uid: 2 }
    )

    expect(validate(invalidFile)).toBe(false)
    expect(warning).toHaveBeenCalledWith(
      "report.pdf 类型不符合要求，仅支持：.png、image/jpeg"
    )
    expect(beforeUpload).not.toHaveBeenCalled()

    expect(validate(validFile)).toBe(true)
    expect(beforeUpload).toHaveBeenCalledWith(validFile)

    warning.mockRestore()
  })
})
