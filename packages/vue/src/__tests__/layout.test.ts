// @vitest-environment happy-dom

import { defineComponent, h, markRaw, nextTick, ref } from "vue"

import { createForm, createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vite-plus/test"

import Button from "../components/Button"
import Col from "../components/Col"
import Row from "../components/Row"
import SchemaList from "../components/SchemaList"
import { provideFormContext } from "../context"
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

const TestRow = defineComponent({
  name: "TestRow",
  props: {
    gutter: Number,
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        "div",
        {
          ...attrs,
          "data-testid": "layout-row",
          "data-gutter": props.gutter === undefined ? undefined : String(props.gutter),
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
  it("内部样式只作用于默认实现，切换外部组件后保留调用方样式和布局属性", async () => {
    // 在同一表单上下文中动态替换三个组件实现。
    const useExternal = ref(false)

    const form = createForm({})

    const TestButton = defineComponent({
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        return () =>
          h("button", { ...attrs, "data-testid": "custom-button" }, slots.default?.())
      },
    })

    const Host = defineComponent({
      setup() {
        provideFormContext({
          form,
          schemaConfig: {},
          get rowComponent() {
            return useExternal.value ? TestRow : undefined
          },
          get colComponent() {
            return useExternal.value ? TestCol : undefined
          },
          get buttonComponent() {
            return useExternal.value ? TestButton : undefined
          },
        })

        return () =>
          h(
            Row,
            {
              row: { gutter: 16, justify: "end", align: "middle" },
              style: { margin: "6px", display: "grid" },
            },
            () =>
              h(
                Col,
                {
                  col: { span: 12, offset: 2 },
                  style: { padding: "3px", width: "75%" },
                },
                () =>
                  h(
                    Button,
                    {
                      class: "schemx-actions-button--submit",
                      style: { color: "red" },
                    },
                    () => "保存"
                  )
              )
          )
      },
    })

    const wrapper = mount(Host)

    for (const selector of [".schemx-row", ".schemx-col", ".schemx-button"]) {
      expect(
        wrapper
          .get(selector)
          .element.getAttributeNames()
          .some((name) => name.startsWith("data-v-"))
      ).toBe(true)
    }

    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-top: 8px"
    )
    expect(wrapper.get(".schemx-col").attributes("style")).toContain("flex-basis: 50%")

    useExternal.value = true
    await nextTick()

    for (const selector of [
      ".schemx-row",
      ".schemx-col",
      '[data-testid="custom-button"]',
    ]) {
      expect(
        wrapper
          .get(selector)
          .element.getAttributeNames()
          .some((name) => name.startsWith("data-v-"))
      ).toBe(false)
    }

    expect(wrapper.get(".schemx-row").attributes("style")).toBe(
      "margin: 6px; display: grid;"
    )
    expect(wrapper.get(".schemx-col").attributes("style")).toBe(
      "padding: 3px; width: 75%;"
    )
    expect(wrapper.get(".schemx-row").attributes("data-gutter")).toBe("16")
    expect(wrapper.get(".schemx-col").attributes("data-span")).toBe("12")
    expect(wrapper.get(".schemx-col").attributes("data-offset")).toBe("2")
    expect(wrapper.find(".schemx-button").exists()).toBe(false)
    expect(wrapper.get('[data-testid="custom-button"]').attributes("style")).toBe(
      "color: red;"
    )
    expect(wrapper.text()).toBe("保存")

    useExternal.value = false
    await nextTick()
    expect(wrapper.get(".schemx-row").attributes("style")).toContain(
      "--schemx-gutter-top: 8px"
    )
    expect(wrapper.get(".schemx-button").text()).toBe("保存")
    wrapper.unmount()
    form.destroy()
  })

  it("为 SchemaList 的列表输出增加包裹层", () => {
    const wrapper = mount(SchemaList, {
      props: {
        schemas: [],
        viewSchemas: [],
      },
    })

    const list = wrapper.find(".schemx-schema-list")

    expect(list.element.tagName).toBe("DIV")
    expect(list.classes()).toContain("schemx-schema-list")

    wrapper.unmount()
  })

  it("使用显式 Row 组件包裹根级和 Group 子级", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        submitter: false,
        resetter: false,
        rendererRegistry,
        colComponent: TestCol,
        rowComponent: TestRow,
        initialValues: {
          title: "标题",
          description: "描述",
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
            layout: { span: 12 },
            children: [
              {
                name: "description",
                label: "描述",
                componentType: "input",
              },
            ],
          },
        ],
      },
    })

    expect(wrapper.findAll("[data-testid='layout-row']")).toHaveLength(2)
    expect(wrapper.findAll(".schemx-row")).toHaveLength(2)

    wrapper.unmount()
  })

  it("使用 Form、Group、Dynamic 的 row 和 Field 的 col 配置", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        submitter: false,
        resetter: false,
        rendererRegistry,
        colComponent: TestCol,
        rowComponent: TestRow,
        row: { gutter: 16 },
        initialValues: {
          title: "标题",
          description: "描述",
          users: [{ name: "Ada" }],
        },
        schemas: [
          {
            name: "title",
            label: "标题",
            componentType: "input",
            col: { span: 12 },
          },
          {
            label: "基本信息",
            row: { gutter: 8 },
            children: [
              {
                name: "description",
                label: "描述",
                componentType: "input",
                col: { span: 6 },
              },
            ],
          },
          {
            key: "users-schema",
            name: "users",
            row: { gutter: 4 },
            item: [
              {
                name: "name",
                label: "姓名",
                componentType: "input",
                col: { span: 8 },
              },
            ],
          },
        ],
      },
    })

    expect(wrapper.findAll("[data-testid='layout-row']")).toHaveLength(3)
    expect(
      wrapper
        .findAll("[data-testid='layout-row']")
        .map((row) => row.attributes("data-gutter"))
    ).toEqual(["16", "8", "4"])
    expect(wrapper.findAll("[data-testid='layout-col']")).toHaveLength(3)
    expect(
      wrapper
        .findAll("[data-testid='layout-col']")
        .map((col) => col.attributes("data-span"))
    ).toEqual(["12", "6", "8"])

    wrapper.unmount()
  })

  it("在顶层、Group 和 Dynamic 行中统一创建 Col 布局", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        submitter: false,
        resetter: false,
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

  it("嵌套 Group 与 Dynamic 各自创建 Row 并通过 SchemaList 创建 Col", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        submitter: false,
        resetter: false,
        rendererRegistry,
        colComponent: TestCol,
        rowComponent: TestRow,
        initialValues: {
          description: "描述",
          users: [{ name: "Ada" }],
        },
        schemas: [
          {
            label: "外层分组",
            layout: { span: 24 },
            children: [
              {
                label: "内层分组",
                layout: { span: 12 },
                children: [
                  {
                    name: "description",
                    label: "描述",
                    componentType: "input",
                    layout: { span: 6 },
                  },
                ],
              },
            ],
          },
          {
            key: "users-schema",
            name: "users",
            layout: { span: 24 },
            item: [
              {
                label: "行内分组",
                layout: { span: 12 },
                children: [
                  {
                    name: "name",
                    label: "姓名",
                    componentType: "input",
                    layout: { span: 8 },
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(wrapper.findAll("[data-testid='layout-row']")).toHaveLength(5)
    expect(wrapper.findAll(".schemx-row")).toHaveLength(5)
    expect(wrapper.findAll("[data-testid='layout-col']")).toHaveLength(6)

    const spans = wrapper
      .findAll("[data-testid='layout-col']")
      .map((col) => col.attributes("data-span"))

    expect(spans).toEqual(["24", "12", "6", "24", "12", "8"])

    wrapper.unmount()
  })

  it("使用 App 安装配置的 Row 和 Col 作为 Form 的布局组件", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      global: {
        plugins: [[Schemx, { colComponent: TestCol, rowComponent: TestRow }]],
      },
      props: {
        submitter: false,
        resetter: false,
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
    expect(wrapper.find("[data-testid='layout-row']").exists()).toBe(true)

    wrapper.unmount()
  })

  it("使用 schemaConfig.row 作为根级 Row 的默认配置", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      global: {
        plugins: [
          [
            Schemx,
            {
              rowComponent: TestRow,
              schemaConfig: { row: { gutter: 16 } },
            },
          ],
        ],
      },
      props: {
        submitter: false,
        resetter: false,
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

    expect(wrapper.get("[data-testid='layout-row']").attributes("data-gutter")).toBe("16")

    wrapper.unmount()
  })

  it("不可见 Schema 不创建空 Col", () => {
    const rendererRegistry = createRendererRegistry("input")

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        submitter: false,
        resetter: false,
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
