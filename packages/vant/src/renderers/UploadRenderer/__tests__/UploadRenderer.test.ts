// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("@schemx/vue", () => ({
  Wrapper: defineComponent({
    name: "SchemxWrapper",
    props: ["readonly", "disabled"],
    setup(props, { attrs, slots }) {
      return () =>
        h(
          "div",
          { ...attrs, class: ["schemx-wrapper", attrs.class] },
          props.readonly ? slots.readonly?.() : slots.default?.()
        )
    },
  }),
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
      "previewImage",
    ],
    emits: ["delete"],
    setup(props) {
      return () => h("div", JSON.stringify(props))
    },
  }),
  Image: defineComponent({
    name: "VantImage",
    props: ["src", "alt", "fit", "width", "height", "lazyLoad"],
    setup(props) {
      return () => h("img", { src: props.src, alt: props.alt })
    },
  }),
  ImagePreview: defineComponent({
    name: "ImagePreview",
    props: ["show", "images", "startPosition", "loop"],
    emits: ["close", "update:show"],
    setup(props) {
      return () => h("div", { class: "image-preview" }, JSON.stringify(props))
    },
  }),
  Icon: defineComponent({
    name: "Icon",
    props: ["name"],
    setup() {
      return () => h("i")
    },
  }),
  Loading: defineComponent({
    name: "Loading",
    setup() {
      return () => h("i")
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

    expect(readonlyWrapper.get(".schemx-wrapper").text()).toContain("暂无附件")
    expect(readonlyWrapper.findComponent({ name: "Uploader" }).exists()).toBe(false)

    readonlyWrapper.unmount()
  })

  it("默认使用卡片列表展示图片和非图片文件", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        value: [
          { url: "https://example.com/photo.png", name: "照片.png" },
          { url: "https://example.com/report.pdf", name: "报告.pdf" },
        ],
      },
    })

    expect(wrapper.findAll(".schemx-upload-card-list__item")).toHaveLength(2)
    expect(wrapper.findComponent({ name: "VantImage" }).props("src")).toBe(
      "https://example.com/photo.png"
    )
    expect(wrapper.get(".schemx-upload-card-list__extension").text()).toBe("PDF")
    expect(wrapper.get(".schemx-upload-card-list__name").text()).toBe("照片.png")
    expect(wrapper.findComponent({ name: "Uploader" }).props("previewImage")).toBe(false)

    wrapper.unmount()
  })

  it("支持列表展示并使用 ImagePreview 预览图片", async () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        listType: "list",
        value: [
          { url: "https://example.com/photo.png", name: "照片.png" },
          { url: "https://example.com/report.pdf", name: "报告.pdf" },
        ],
        previewOptions: { loop: false },
      },
    })

    expect(wrapper.findAll(".schemx-upload-list__item")).toHaveLength(2)
    expect(
      wrapper.findAll(".schemx-upload-list__name").map((item) => item.text())
    ).toEqual(["照片", "报告"])
    expect(
      wrapper.findAll(".schemx-upload-list__extension").map((item) => item.text())
    ).toEqual(["PNG", "PDF"])

    const imagePreview = wrapper.findComponent({ name: "ImagePreview" })

    await wrapper.findAll(".schemx-upload-list__item")[1].trigger("click")

    expect(imagePreview.props("show")).toBe(false)

    await wrapper.findAll(".schemx-upload-list__item")[0].trigger("click")

    expect(imagePreview.props("show")).toBe(true)
    expect(imagePreview.props("images")).toEqual(["https://example.com/photo.png"])
    expect(imagePreview.props("startPosition")).toBe(0)
    expect(imagePreview.props("loop")).toBe(false)

    wrapper.unmount()
  })

  it("默认允许点击图片打开预览", async () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        value: [{ url: "https://example.com/photo.png", name: "照片.png" }],
      },
    })

    await wrapper.get(".schemx-upload-card-list__preview").trigger("click")

    expect(wrapper.findComponent({ name: "ImagePreview" }).props("show")).toBe(true)

    wrapper.unmount()
  })

  it("关闭 previewFullImage 时不打开图片预览", async () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        previewFullImage: false,
        value: [{ url: "https://example.com/photo.png", name: "照片.png" }],
      },
    })

    await wrapper.get(".schemx-upload-card-list__preview").trigger("click")

    expect(wrapper.findComponent({ name: "ImagePreview" }).props("show")).toBe(false)

    wrapper.unmount()
  })

  it("删除前遵守 beforeDelete 拦截器", async () => {
    const onChange = vi.fn()

    const beforeDelete = vi.fn().mockReturnValue(false)

    const wrapper = mount(UploadRenderer, {
      props: {
        onChange,
        beforeDelete,
        value: [{ url: "https://example.com/report.pdf", name: "报告.pdf" }],
      },
    })

    await wrapper.get(".schemx-upload-card-list__delete").trigger("click")

    expect(beforeDelete).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
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
