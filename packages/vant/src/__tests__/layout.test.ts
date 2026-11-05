// @vitest-environment happy-dom

import type { Component } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

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
    expect(wrapper.get(".schemx-col--auto").classes()).toContain("van-col")
    expect(wrapper.get(".schemx-col--auto").attributes("auto")).toBeUndefined()
    expect(wrapper.find(".van-col--12").exists()).toBe(true)
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
    wrapper.unmount()
  })

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
    // happy-dom 会丢弃 padding 中的 CSS 变量，检查实际传给 UI 组件的样式。
    expect(wrapper.getComponent({ name: "van-col" }).vm.$attrs.style).toMatchObject({
      paddingTop: "var(--schemx-gutter-top, 0px)",
      paddingLeft: "var(--schemx-gutter-left, 0px)",
    })

    wrapper.unmount()
  })
})
