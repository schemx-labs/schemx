// @vitest-environment happy-dom

/**
 * Group 容器行为测试。
 *
 * 覆盖可见性、受控折叠、禁用交互、销毁策略和 ARIA 属性。
 *
 * @module components/Group/__tests__/Group
 */

import { h } from "vue"

import { mount as mountComponent } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import Group, { type SchemxGroupProps } from "../index"

import type { SchemxViewGroupSchema, SchemxViewSchema } from "@schemx/core"

type GroupMountSlots = NonNullable<Parameters<typeof mountComponent>[1]>["slots"]

interface GroupMountOptions {
  props: Pick<SchemxGroupProps, "schema"> & Partial<Omit<SchemxGroupProps, "schema">>
  slots?: GroupMountSlots
}

const mount = (_component: typeof Group, options: GroupMountOptions) =>
  mountComponent(Group, {
    ...options,
    props: {
      ...options.props,
      renderChildren: options.props.renderChildren ?? (() => null),
    },
  })

describe("Group", () => {
  it("将完整 children 交给 SchemaList 渲染回调", () => {
    const schema = createSchema({
      children: [createSchema({ key: "child", label: "子分组" })],
    })

    const renderChildren = vi.fn(() => null)

    mountComponent(Group, {
      props: { schema, renderChildren },
    })

    expect(renderChildren).toHaveBeenCalledWith(schema.children)
  })

  it("visible=false 时不渲染 Group DOM", () => {
    const wrapper = mount(Group, {
      props: { schema: createSchema({ visible: false }) },
    })

    expect(wrapper.find(".schemx-group").exists()).toBe(false)
  })

  it("非受控模式使用 defaultCollapsed 初始化并触发变更回调", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          defaultCollapsed: true,
          onCollapsedChange,
        }),
      },
    })

    expect(wrapper.find(".schemx-group__body").exists()).toBe(false)

    await wrapper.find(".schemx-group__header").trigger("click")

    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(wrapper.find(".schemx-group__body").exists()).toBe(true)
  })

  it("受控模式由 collapsed 驱动且不会自行修改状态", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          collapsed: true,
          onCollapsedChange,
        }),
      },
    })

    await wrapper.find(".schemx-group__header").trigger("click")

    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(wrapper.find(".schemx-group__body").exists()).toBe(false)

    await wrapper.setProps({
      schema: createSchema({
        collapsible: true,
        collapsed: false,
        onCollapsedChange,
      }),
    })

    expect(wrapper.find(".schemx-group__body").exists()).toBe(true)
  })

  it("从受控模式切回非受控模式时应保留最后一个受控值", async () => {
    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          collapsed: true,
        }),
      },
    })

    await wrapper.setProps({
      schema: createSchema({
        collapsible: true,
        collapsed: false,
      }),
    })
    await wrapper.setProps({
      schema: createSchema({
        collapsible: true,
      }),
    })

    expect(wrapper.find(".schemx-group__body").exists()).toBe(true)
  })

  it("disabled 时禁止鼠标和键盘折叠交互", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          disabled: true,
          onCollapsedChange,
        }),
      },
    })

    const header = wrapper.find(".schemx-group__header")

    await header.trigger("click")
    await header.trigger("keydown", { key: "Enter" })
    await header.trigger("keydown", { key: " " })

    expect(onCollapsedChange).not.toHaveBeenCalled()
    expect(header.attributes("tabindex")).toBe("-1")
    expect(header.attributes("aria-disabled")).toBe("true")
    expect(wrapper.find(".schemx-group").classes()).toContain("is-disabled")
  })

  it("readonly 仅约束后代字段，不阻止 Group 折叠", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          readonly: true,
          onCollapsedChange,
        }),
      },
    })

    await wrapper.find(".schemx-group__header").trigger("click")

    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    expect(wrapper.find(".schemx-group").classes()).toContain("is-readonly")
    expect(wrapper.find(".schemx-group__body").exists()).toBe(false)
  })

  it("destroyOnCollapse=true 时卸载后代实例", () => {
    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          collapsed: true,
          destroyOnCollapse: true,
          children: [createSchema({ key: "nested", label: "嵌套分组" })],
        }),
      },
    })

    expect(wrapper.find(".schemx-group__body").exists()).toBe(false)
    expect(wrapper.find('[data-key="nested"]').exists()).toBe(false)
  })

  it("destroyOnCollapse=false 时隐藏 Body 但保留后代实例", () => {
    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          collapsible: true,
          collapsed: true,
          destroyOnCollapse: false,
          children: [createSchema({ key: "nested", label: "嵌套分组" })],
        }),
        renderChildren: (schemas: readonly SchemxViewSchema[]) =>
          schemas.map((schema) =>
            h(Group, {
              key: schema.key,
              schema: schema as SchemxViewGroupSchema,
              renderChildren: () => null,
            })
          ),
      },
    })

    const body = wrapper.find(".schemx-group__body")

    expect(body.exists()).toBe(true)
    expect(body.attributes("style")).toContain("display: none")
    expect(wrapper.find('[data-key="nested"]').exists()).toBe(true)
  })

  it("可折叠标题和 Body 应建立完整的 ARIA 关联", () => {
    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          key: "profile/basic",
          collapsible: true,
          debug: {
            runtimeNodeId: 42,
            runtimeNodeType: "group",
            hasRuntimeState: true,
            hasDependencyEffect: false,
          },
        }),
      },
    })

    const header = wrapper.find(".schemx-group__header")

    const body = wrapper.find(".schemx-group__body")

    expect(header.attributes("id")).toBe("schemx-group-42-profile-basic-header")
    expect(header.attributes("aria-controls")).toBe("schemx-group-42-profile-basic-body")
    expect(header.attributes("aria-expanded")).toBe("true")
    expect(body.attributes("aria-labelledby")).toBe(
      "schemx-group-42-profile-basic-header"
    )
  })

  it("清洗后 key 相同的独立 Group 仍应生成不同 ARIA ID", () => {
    const first = mount(Group, {
      props: { schema: createSchema({ key: "profile/basic", collapsible: true }) },
    })

    const second = mount(Group, {
      props: { schema: createSchema({ key: "profile-basic", collapsible: true }) },
    })

    expect(first.find(".schemx-group__header").attributes("id")).not.toBe(
      second.find(".schemx-group__header").attributes("id")
    )
  })

  it("应支持以 Group key 命名的 Header、Label 与 Content 插槽", () => {
    const wrapper = mount(Group, {
      props: { schema: createSchema({ key: "profile.basic", collapsible: true }) },
      slots: {
        "profile.basicHeader": ({
          collapsed,
          toggle,
        }: {
          collapsed: boolean
          toggle: () => void
        }) =>
          h(
            "button",
            { "data-testid": "header-slot", onClick: toggle },
            String(collapsed)
          ),
        "profile.basicLabel": () => h("span", { "data-testid": "label-slot" }),
        "profile.basicContent": () => h("div", { "data-testid": "content-slot" }),
      },
    })

    expect(wrapper.find('[data-testid="header-slot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="label-slot"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="content-slot"]').exists()).toBe(true)
  })

  it("Label 插槽应替换默认标题并保留默认折叠控制", async () => {
    const wrapper = mount(Group, {
      props: { schema: createSchema({ key: "profile", collapsible: true }) },
      slots: {
        profileLabel: () => h("span", { "data-testid": "label-slot" }, "自定义资料"),
      },
    })

    expect(wrapper.get('[data-testid="label-slot"]').text()).toBe("自定义资料")
    expect(wrapper.find(".schemx-group__title").exists()).toBe(false)

    await wrapper.find(".schemx-group__header").trigger("click")

    expect(wrapper.find(".schemx-group__body").exists()).toBe(false)
  })

  it("应合并内部、父级和 Schema 的 class/style 到 Group wrapper", () => {
    const wrapper = mount(Group, {
      props: {
        schema: createSchema({
          class: "schema-group",
          style: { color: "red" },
        }),
        class: "parent-group",
        style: { color: "blue", marginTop: "4px" },
      },
    })

    const group = wrapper.find(".schemx-group")

    const groupWrapper = wrapper.find(".schemx-group-wrapper")

    expect(groupWrapper.exists()).toBe(true)
    expect(groupWrapper.classes()).toContain("parent-group")
    expect(groupWrapper.classes()).toContain("schema-group")
    expect(groupWrapper.attributes("style")).toContain("color: red")
    expect(groupWrapper.attributes("style")).toContain("margin-top: 4px")
    expect(group.classes()).toContain("schemx-group")
  })
})

function createSchema(
  overrides: Partial<SchemxViewGroupSchema> = {}
): SchemxViewGroupSchema {
  return {
    key: "profile",
    label: "资料",
    children: [],
    visible: true,
    readonly: false,
    disabled: false,
    ...overrides,
  } as SchemxViewGroupSchema
}
