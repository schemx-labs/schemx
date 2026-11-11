// @vitest-environment happy-dom

import type { Component } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import SchemxForm, { presetRuleRegistry, rendererRegistry } from "../index"
import { ElementPlusCol } from "../layout/defaultCol"
import { ElementPlusRow } from "../layout/defaultRow"

const defaultProps = {
  rendererRegistry,
  presetRuleRegistry,
  colComponent: ElementPlusCol,
  rowComponent: ElementPlusRow,
  col: { span: 12 },
  row: { gutter: [14, 16] },
  labelAlign: "right" as const,
  labelPosition: "left" as const,
  contentAlign: "left" as const,
  bordered: false,
}

function mountElementPlusForm(props: Record<string, unknown> = {}) {
  return mount(SchemxForm as Component, {
    props: {
      ...defaultProps,
      ...props,
    },
  })
}

describe("Element Plus Col layout adapter", () => {
  it("auto 列保留适配器、控件和 gutter，切换布局不重建输入", async () => {
    // 表单默认 auto，字段可显式覆盖回栅格。
    const wrapper = mount(SchemxForm as Component, {
      props: {
        col: "auto",
        actionCol: "auto",
        row: { gutter: [8, 16] },
        initialValues: { first: "before", second: "B" },
        schemas: [
          {
            name: "first",
            label: "自动",
            componentType: "input",
            componentProps: { style: { width: "180px" } },
          },
          { name: "second", label: "栅格", componentType: "input", col: { span: 12 } },
        ],
      },
    })

    // 切换前的输入节点用于验证字段不会因布局变化而重挂载。
    const input = wrapper.findAll("input")[0]?.element

    expect(wrapper.findAll(".schemx-col--auto")).toHaveLength(2)
    expect(wrapper.get(".schemx-col--auto").classes()).toContain("el-col")
    // 自动字段和操作列都不应携带 Element Plus 的默认跨度类。
    for (const column of wrapper.findAll(".schemx-col--auto")) {
      expect(column.classes()).not.toContain("el-col-24")
    }

    expect(wrapper.get(".schemx-col--auto").attributes("auto")).toBeUndefined()
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.find(".schemx-renderer--auto").exists()).toBe(false)
    expect(wrapper.find(".schemx-field--auto").exists()).toBe(false)
    expect(wrapper.get(".schemx-field__content").attributes("style")).not.toContain(
      "width:"
    )
    await wrapper.findAll("input")[0]?.setValue("changed")
    await wrapper.setProps({ col: { span: 8 } })
    await vi.waitFor(() => expect(wrapper.findAll(".schemx-col--auto")).toHaveLength(1))
    expect(wrapper.findAll("input")[0]?.element).toBe(input)
    expect(wrapper.findAll("input")[0]?.element.value).toBe("changed")
    expect(wrapper.find(".el-col-8").exists()).toBe(true)
    await wrapper.setProps({ col: "auto" })
    await vi.waitFor(() => expect(wrapper.findAll(".schemx-col--auto")).toHaveLength(2))
    // 从栅格切回自动列时，也应移除之前的跨度类并保留输入节点。
    for (const column of wrapper.findAll(".schemx-col--auto")) {
      expect(column.classes().some((name) => /^el-col-\d+$/.test(name))).toBe(false)
    }

    expect(wrapper.findAll("input")[0]?.element).toBe(input)
    wrapper.unmount()
  })

  it("未安装插件时入口组件的完整默认配置生效", () => {
    const wrapper = mount(SchemxForm as Component, {
      props: {
        submitter: false,
        resetter: false,
        initialValues: { first: "A" },
        schemas: [{ name: "first", label: "第一项", componentType: "input" }],
      },
    })

    expect(wrapper.find(".el-input").exists()).toBe(true)
    expect(wrapper.find(".el-row").exists()).toBe(true)
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 120px"
    )
    expect(wrapper.get(".el-row").attributes("style")).toContain(
      "--schemx-gutter-top: 7px"
    )
    expect(wrapper.get(".schemx-field-wrapper").classes()).not.toContain("is-bordered")
    wrapper.unmount()
  })

  it("应用 PC 端默认布局与字段展示配置", () => {
    const wrapper = mountElementPlusForm({
      initialValues: { first: "A" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
        },
      ],
    })

    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.get(".schemx-field-wrapper").classes()).not.toContain("is-bordered")
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "text-align: right"
    )
    expect(wrapper.get(".schemx-field__content").attributes("style")).toContain(
      "text-align: left"
    )

    wrapper.unmount()
  })

  it("只读字段将内容对齐到右侧", () => {
    const wrapper = mountElementPlusForm({
      initialValues: { first: "A" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
          readonly: true,
        },
      ],
    })

    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "text-align: right"
    )
    expect(wrapper.get(".schemx-field__content").attributes("style")).toContain(
      "text-align: right"
    )

    wrapper.unmount()
  })

  it("导入 Element Plus 适配包后使用 ElCol 渲染 Schema col", () => {
    const wrapper = mountElementPlusForm({
      initialValues: { first: "A", second: "B" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
          col: { span: 12, offset: 2 },
        },
        {
          name: "second",
          label: "第二项",
          componentType: "input",
          col: { span: 6, block: true },
        },
      ],
    })

    expect(wrapper.find(".schemx-row").exists()).toBe(true)
    expect(wrapper.find(".el-row").exists()).toBe(true)
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.find(".el-col-offset-2").exists()).toBe(true)
    expect(wrapper.find(".el-col-24").exists()).toBe(true)
    expect(wrapper.find("[fullline]").exists()).toBe(false)

    wrapper.unmount()
  })

  it("通过适配层为 Element Plus Row/Col 提供四边 gutter", () => {
    const wrapper = mountElementPlusForm({
      row: { gutter: [4, 8, 12, 16] },
      initialValues: { first: "A" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
          col: { span: 12 },
        },
      ],
    })

    const row = wrapper.get(".el-row")

    const col = wrapper.get(".el-col")

    expect(row.attributes("style")).toContain("--schemx-gutter-top: 2px")
    expect(row.attributes("style")).toContain("margin: -2px -4px -6px -8px")
    expect(col.classes()).toContain("schemx-col")
    // happy-dom 会丢弃 padding 中的 CSS 变量，检查实际传给 UI 组件的样式。
    expect(wrapper.getComponent({ name: "ElCol" }).vm.$attrs.style).toMatchObject({
      paddingTop: "var(--schemx-gutter-top, 0px)",
      paddingLeft: "var(--schemx-gutter-left, 0px)",
    })

    wrapper.unmount()
  })
})
