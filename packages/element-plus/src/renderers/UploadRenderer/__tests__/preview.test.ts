// @vitest-environment happy-dom

import { defineComponent, h, nextTick, ref } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import FileDisplay from "../file-display.vue"
import FilePreview from "../preview.vue"

interface FilePreviewExposed {
  open(target: unknown): void
  download(target: unknown): Promise<void>
}

interface FilePreviewProps {
  files: unknown[]
}

const imageViewerStub = defineComponent({
  name: "ElImageViewer",
  inheritAttrs: false,
  props: {
    urlList: { type: Array, default: () => [] },
    initialIndex: { type: Number, default: 0 },
    showProgress: { type: Boolean, default: true },
  },
  emits: ["switch", "close", "error", "rotate"],
  setup(props, { emit, expose, slots }) {
    const activeIndex = ref(props.initialIndex)

    const setActiveItem = (index: number) => {
      const nextIndex = (index + props.urlList.length) % props.urlList.length

      if (nextIndex !== activeIndex.value) {
        activeIndex.value = nextIndex
        emit("switch", nextIndex)
      }
    }

    const prev = () => setActiveItem(activeIndex.value - 1)

    const next = () => setActiveItem(activeIndex.value + 1)

    expose({ setActiveItem })

    return () =>
      h("div", { "data-active-index": activeIndex.value }, [
        slots.toolbar?.({
          actions: vi.fn(),
          prev,
          next,
          reset: vi.fn(),
          activeIndex: activeIndex.value,
          setActiveItem,
        }),
        slots.default?.(),
      ])
  },
})

const iconStub = defineComponent({
  name: "ElIcon",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", attrs, slots.default?.())
  },
})

const buttonStub = defineComponent({
  name: "ElButton",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", attrs, slots.default?.())
  },
})

const tooltipStub = defineComponent({
  name: "ElTooltip",
  setup(_, { slots }) {
    return () => h("span", slots.default?.())
  },
})

const globalStubs = {
  stubs: {
    ElImageViewer: imageViewerStub,
    ElIcon: iconStub,
    ElButton: buttonStub,
    ElTooltip: tooltipStub,
  },
}

describe("UploadRenderer file preview", () => {
  it("keeps mixed and source-less files in one viewer sequence", async () => {
    const firstImage = { uid: 1, name: "first.png", type: "image/png", url: "/first.png" }

    const pdf = {
      uid: 2,
      name: "report.pdf",
      type: "application/pdf",
      url: "/report.pdf",
    }

    const sourceLessFile = {
      uid: 3,
      name: "pending.bin",
      type: "application/octet-stream",
    }

    const secondImage = {
      uid: 4,
      name: "second.jpg",
      type: "image/jpeg",
      url: "/second.jpg",
    }

    const files = [firstImage, null, pdf, sourceLessFile, secondImage]

    const downloadHandler = vi.fn()

    const wrapper = mount(FilePreview, {
      props: { files, downloadHandler },
      global: globalStubs,
    })

    const preview = wrapper.vm as unknown as FilePreviewExposed

    preview.open(pdf)
    await nextTick()

    const viewer = wrapper.findComponent({ name: "ElImageViewer" })

    const viewerUrls = viewer.props("urlList")

    expect(viewerUrls).toHaveLength(4)
    expect(viewerUrls[0]).toBe("/first.png")
    expect(viewerUrls[1]).toBe(
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    )
    expect(viewerUrls[2]).toBe(viewerUrls[1])
    expect(viewerUrls[3]).toBe("/second.jpg")
    expect(viewer.props("initialIndex")).toBe(1)
    expect(viewer.props("showProgress")).toBe(true)
    expect(wrapper.text()).toContain("该文件不支持预览")

    expect(wrapper.find(".file-preview__unsupported button").exists()).toBe(true)
    await preview.download(pdf)
    expect(downloadHandler).toHaveBeenCalledWith(pdf, 2)

    await wrapper.find('[aria-label="下一张"]').trigger("click")
    await nextTick()
    expect(wrapper.text()).toContain("该文件暂无可预览内容")
    expect(wrapper.find('[aria-label="下载"]').exists()).toBe(false)

    preview.open(firstImage)
    await nextTick()
    expect(viewer.attributes("data-active-index")).toBe("0")

    const updateProps = wrapper.setProps.bind(wrapper) as unknown as (
      props: FilePreviewProps
    ) => Promise<void>

    await updateProps({ files: [secondImage, null, firstImage, pdf, sourceLessFile] })
    await nextTick()
    expect(viewer.attributes("data-active-index")).toBe("1")
    expect(viewer.props("urlList")[1]).toBe("/first.png")
  })

  it("allows source-less files to open while hiding their download action", async () => {
    const file = { uid: 1, name: "pending.bin", type: "application/octet-stream" }

    const wrapper = mount(FileDisplay, {
      props: { file, index: 0 },
      global: globalStubs,
    })

    const textInfo = wrapper.find(".file-display__text-info")

    expect(textInfo.classes()).toContain("file-display__text-info--clickable")
    expect(wrapper.findComponent({ name: "FileActions" }).props("canDownload")).toBe(
      false
    )

    await textInfo.trigger("click")
    expect(wrapper.emitted("preview")).toEqual([[file]])
    expect(wrapper.find('[aria-label="下载"]').exists()).toBe(false)
  })
})
