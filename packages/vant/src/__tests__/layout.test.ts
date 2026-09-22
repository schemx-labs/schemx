// @vitest-environment happy-dom

import type { Component } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SchemxForm, { presetRuleRegistry, rendererRegistry } from "../index"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"

const defaultProps = {
  rendererRegistry,
  presetRuleRegistry,
  colComponent: VantCol,
  rowComponent: VantRow,
  col: { span: 24 },
  row: { gutter: [0, 0] },
  labelAlign: "right" as const,
  labelPosition: "left" as const,
  contentAlign: "left" as const,
  bordered: true,
}

function mountVantForm(props: Record<string, unknown> = {}) {
  return mount(SchemxForm as Component, {
    props: {
      ...defaultProps,
      ...props,
    },
  })
}

describe("Vant Col layout adapter", () => {
  it("应用移动端默认布局与字段展示配置", () => {
    const wrapper = mountVantForm({
      initialValues: { first: "A" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
        },
      ],
    })

    expect(wrapper.find(".van-col--24").exists()).toBe(true)
    expect(wrapper.get(".schemx-field-wrapper").classes()).toContain("is-bordered")
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "text-align: right"
    )
    expect(wrapper.get(".schemx-field__content").attributes("style")).toContain(
      "text-align: left"
    )

    wrapper.unmount()
  })

  it("只读字段将内容对齐到右侧", () => {
    const wrapper = mountVantForm({
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

  it("允许 Form 显式配置覆盖移动端默认值", () => {
    const wrapper = mountVantForm({
      col: { span: 12 },
      contentAlign: "left",
      bordered: false,
      initialValues: { first: "A" },
      schemas: [
        {
          name: "first",
          label: "第一项",
          componentType: "input",
        },
      ],
    })

    expect(wrapper.find(".van-col--12").exists()).toBe(true)
    expect(wrapper.get(".schemx-field-wrapper").classes()).not.toContain("is-bordered")
    expect(wrapper.get(".schemx-field__content").attributes("style")).toContain(
      "text-align: left"
    )

    wrapper.unmount()
  })

  it("导入 Vant 适配包后使用 VanCol 渲染 Schema col", () => {
    const wrapper = mountVantForm({
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
    expect(wrapper.find(".van-row").exists()).toBe(true)
    expect(wrapper.find(".van-col--12").exists()).toBe(true)
    expect(wrapper.find(".van-col--offset-2").exists()).toBe(true)
    expect(wrapper.find(".van-col--24").exists()).toBe(true)
    expect(wrapper.find("[fullline]").exists()).toBe(false)

    wrapper.unmount()
  })

  it("通过适配层为 Vant Row/Col 提供四边 gutter", () => {
    const wrapper = mountVantForm({
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

    const row = wrapper.get(".van-row")

    expect(row.attributes("style")).toContain("--schemx-gutter-top: 2px")
    expect(row.attributes("style")).toContain("margin: -2px -4px -6px -8px")
    expect(wrapper.get(".schemx-col").classes()).toContain("van-col")

    wrapper.unmount()
  })
})
