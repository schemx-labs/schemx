// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { mockSearchGeometry } from "../../../vue/src/__tests__/helpers/searchGeometry"
import { configureSchemx, SchemxSearch } from "../index"

beforeEach(() => {
  mockSearchGeometry()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  configureSchemx()
})

describe("Element Plus Search 入口", () => {
  it("默认使用本包 Renderer、栅格和按钮，折叠条件仍参与查询及重置", async () => {
    // 查询回调应收到完整条件，包括已折叠的城市字段。
    const onFinish = vi.fn()

    // 默认 col.span 为 12，因此三个字段收起时只显示前两个，全部保持挂载。
    const wrapper = mount(SchemxSearch, {
      props: {
        initialValues: { keyword: "课程", owner: "张明", city: "上海" },
        schemas: [
          { name: "keyword", label: "关键词", componentType: "input" },
          { name: "owner", label: "负责人", componentType: "input" },
          { name: "city", label: "城市", componentType: "input" },
        ],
        onFinish,
      },
    })

    await flushPromises()
    expect(wrapper.findAll(".el-input")).toHaveLength(3)
    expect(wrapper.findAll(".schemx-col[inert]")).toHaveLength(1)
    expect(wrapper.findAll(".el-col-12")).toHaveLength(3)
    expect(wrapper.get(".schemx-actions-button--submit").classes()).toContain(
      "el-button--primary"
    )
    expect(wrapper.get(".schemx-actions-button--submit").text()).toBe("查询")
    await wrapper.findAll("input")[0]?.setValue("预约")
    await wrapper.get(".schemx-actions-button--submit").trigger("click")
    await flushPromises()
    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish).toHaveBeenCalledWith({
      keyword: "预约",
      owner: "张明",
      city: "上海",
    })

    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(wrapper.findAll(".el-input")).toHaveLength(3)
    await wrapper.get(".schemx-actions-button--reset").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")[0]?.element.value).toBe("课程")
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("收起")
    wrapper.unmount()
  })

  it("collapse 的 buttonProps 使用 Element Plus 按钮外观", async () => {
    // 三个字段产生可折叠的第二行，折叠按钮沿用当前 UI 包的属性。
    const wrapper = mount(SchemxSearch, {
      props: {
        schemas: [
          { name: "keyword", label: "关键词", componentType: "input" },
          { name: "owner", label: "负责人", componentType: "input" },
          { name: "city", label: "城市", componentType: "input" },
        ],
        collapse: { buttonProps: { type: "success", round: true } },
      },
    })

    await flushPromises()
    expect(wrapper.get(".schemx-search-collapse").classes()).toContain(
      "el-button--success"
    )
    await flushPromises()
    expect(wrapper.get(".schemx-search-collapse").classes()).toContain("is-round")
    wrapper.unmount()
  })

  it("继承本包 configureSchemx 的新实例配置", () => {
    configureSchemx({ schemaConfig: { labelWidth: 160 }, submitter: { text: "筛选" } })
    // 不显式传入配置，验证使用的是本包工厂而非 Vue 的普通 Search。
    const wrapper = mount(SchemxSearch, {
      props: { schemas: [{ name: "keyword", label: "关键词", componentType: "input" }] },
    })

    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain("160px")
    expect(wrapper.get(".schemx-actions-button--submit").text()).toBe("筛选")
    wrapper.unmount()
  })
})
