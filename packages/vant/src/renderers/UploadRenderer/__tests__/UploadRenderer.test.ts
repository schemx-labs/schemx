// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("@schemx/vue", () => ({
  useFieldContext: () => ({ setPending: vi.fn() }),
}))

vi.mock("vant", () => ({
  Uploader: defineComponent({
    name: "Uploader",
    props: [
      "modelValue",
      "showUpload",
      "deletable",
      "disabled",
      "readonly",
      "multiple",
      "afterRead",
      "maxCount",
    ],
    emits: ["delete"],
    setup(props) {
      return () => h("div", JSON.stringify(props))
    },
  }),
}))

import UploadRenderer from "../index.vue"

describe("UploadRenderer", () => {
  it("未知 view 属性不改变上传器状态", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        view: true,
        value: [{ url: "https://example.com/a.png" }],
      } as any,
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    expect(uploader.props("showUpload")).toBe(true)
    expect(uploader.props("deletable")).toBe(true)
    expect(uploader.props("readonly")).toBe(false)
    expect(uploader.props("disabled")).toBe(false)

    wrapper.unmount()
  })

  it("把 Uploader 原生属性从 props 透传给子组件", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        value: [],
        maxCount: 3,
        readonlyPlaceholder: "-",
        formItemProps: { name: "files" } as any,
        formInstance: {} as any,
      },
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    expect(uploader.props("maxCount")).toBe(3)
    expect(uploader.attributes("readonly-placeholder")).toBeUndefined()
    expect(uploader.attributes("form-item-props")).toBeUndefined()
    expect(uploader.attributes("form-instance")).toBeUndefined()

    wrapper.unmount()
  })

  it("支持 multiple、disableUpload 与只读空值占位", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        multiple: false,
        disableUpload: true,
      },
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    expect(uploader.props("multiple")).toBe(false)
    expect(uploader.props("showUpload")).toBe(false)
    expect(uploader.props("disabled")).toBe(false)

    wrapper.unmount()

    const readonlyWrapper = mount(UploadRenderer, {
      props: {
        readonly: true,
        readonlyPlaceholder: "暂无附件",
      },
    })

    expect(readonlyWrapper.get(".schemx-cell__value").text()).toBe("暂无附件")
    expect(readonlyWrapper.findComponent({ name: "Uploader" }).exists()).toBe(false)

    readonlyWrapper.unmount()
  })

  it("propsHttp 可以覆盖上传响应字段映射", async () => {
    const onChange = vi.fn()

    const wrapper = mount(UploadRenderer, {
      props: {
        onChange,
        propsHttp: { res: "payload", url: "fileUrl", name: "fileName" },
        uploader: vi.fn().mockResolvedValue({
          payload: { fileUrl: "https://example.com/custom.png", fileName: "自定义文件" },
        }),
      },
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    const file = new File(["image"], "source.png", { type: "image/png" })

    await uploader.props("afterRead")(
      { file, objectUrl: "blob:source.png" },
      { name: "file", index: 0 }
    )
    await Promise.resolve()

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        url: "https://example.com/custom.png",
        name: "自定义文件",
      }),
    ])

    wrapper.unmount()
  })
})
