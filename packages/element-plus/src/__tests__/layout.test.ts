// @vitest-environment happy-dom

import type { Component } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

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

    wrapper.unmount()
  })
})
