// @vitest-environment happy-dom

import { h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import Dynamic from "../index"

import type { SchemxViewDynamicSchema, SchemxViewSchema } from "@schemx/core"

describe("Dynamic", () => {
  it("按行将 children 委托给 SchemaList 渲染回调", () => {
    const firstChildren = [createField("users.0.name")]

    const secondChildren = [createField("users.1.name")]

    const schema = createSchema([
      { key: "row-a", index: 0, children: firstChildren },
      { key: "row-b", index: 1, children: secondChildren },
    ])

    const renderChildren = vi.fn((schemas: readonly SchemxViewSchema[]) =>
      h("div", { "data-row-size": schemas.length })
    )

    const wrapper = mount(Dynamic, {
      props: { schema, renderChildren },
    })

    expect(renderChildren).toHaveBeenCalledTimes(2)
    expect(renderChildren).toHaveBeenNthCalledWith(1, firstChildren)
    expect(renderChildren).toHaveBeenNthCalledWith(2, secondChildren)
    expect(wrapper.findAll("[data-row-size='1']")).toHaveLength(2)
  })

  it("visible=false 时不调用子级渲染回调", () => {
    const renderChildren = vi.fn(() => null)

    const wrapper = mount(Dynamic, {
      props: {
        schema: createSchema([], { visible: false }),
        renderChildren,
      },
    })

    expect(renderChildren).not.toHaveBeenCalled()
    expect(wrapper.html()).toBe("")
  })
})

function createField(name: string): SchemxViewSchema {
  return {
    key: name,
    name,
    label: name,
    componentType: "input",
    visible: true,
    readonly: false,
    disabled: false,
    componentProps: {},
    rules: [],
  } as unknown as SchemxViewSchema
}

function createSchema(
  items: SchemxViewDynamicSchema["items"],
  overrides: Partial<SchemxViewDynamicSchema> = {}
): SchemxViewDynamicSchema {
  return {
    key: "users",
    name: "users",
    label: "用户",
    componentType: "dynamic",
    visible: true,
    readonly: false,
    disabled: false,
    items,
    ...overrides,
  } as SchemxViewDynamicSchema
}
