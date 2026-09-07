import { defineComponent, h, markRaw } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Schemx from "../form"
import SchemxForm from "../form.vue"

const TestCol = defineComponent({
  name: "TestCol",
  props: {
    span: Number,
    offset: Number,
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        "div",
        {
          ...attrs,
          "data-testid": "layout-col",
          "data-span": String(props.span),
          "data-offset": String(props.offset),
        },
        slots.default?.()
      )
  },
})

const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

describe("Vue SchemaList layout", () => {
  it("在顶层、Group 和 Dynamic 行中统一创建 Col 布局", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        colComponent: TestCol,
        initialValues: {
          title: "标题",
          description: "描述",
          users: [{ name: "Ada", email: "ada@example.com" }],
        },
        schemas: [
          {
            name: "title",
            label: "标题",
            componentType: "input",
            layout: { span: 12 },
          },
          {
            label: "基本信息",
            layout: { span: 24 },
            children: [
              {
                name: "description",
                label: "描述",
                componentType: "input",
                layout: { span: 6 },
              },
            ],
          },
          {
            key: "users-schema",
            name: "users",
            layout: { span: 24 },
            item: [
              {
                name: "name",
                label: "姓名",
                componentType: "input",
                layout: { span: 8 },
              },
              {
                name: "email",
                label: "邮箱",
                componentType: "input",
                layout: { span: 8, block: true },
              },
            ],
          },
        ],
      },
    })

    expect(wrapper.findAll(".schemx-row")).toHaveLength(3)
    expect(wrapper.findAll("[data-testid='layout-col']")).toHaveLength(6)

    const spans = wrapper
      .findAll("[data-testid='layout-col']")
      .map((col) => col.attributes("data-span"))

    expect(spans).toEqual(["12", "24", "6", "24", "8", "24"])

    const fullLineCol = wrapper.findAll("[data-testid='layout-col']")[5]

    expect(fullLineCol?.attributes("data-offset")).toBe("0")
    expect(fullLineCol?.attributes("fullline")).toBeUndefined()

    wrapper.unmount()
  })

  it("使用 App 安装配置的 Col 作为 Form 的布局组件", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      global: {
        plugins: [[Schemx, { colComponent: TestCol }]],
      },
      props: {
        rendererRegistry,
        schemas: [
          {
            name: "title",
            label: "标题",
            componentType: "input",
          },
        ],
      },
    })

    expect(wrapper.find(".schemx-row").exists()).toBe(true)
    expect(wrapper.find("[data-testid='layout-col']").exists()).toBe(true)

    wrapper.unmount()
  })

  it("不可见 Schema 不创建空 Col", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        colComponent: TestCol,
        schemas: [
          {
            name: "title",
            label: "标题",
            componentType: "input",
            visible: false,
          },
        ],
      },
    })

    expect(wrapper.findAll("[data-testid='layout-col']")).toHaveLength(0)
    expect(wrapper.findAll(".schemx-row")).toHaveLength(1)

    wrapper.unmount()
  })
})
