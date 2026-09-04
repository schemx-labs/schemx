import { describe, expect, it } from "vitest"

import { normalizeSchemas } from "../../../utils"
import { isDependencyNode, isFieldNode, isGroupNode } from "../../node/helper"
import { createCompile } from "../index"

import type { SchemxField, SchemxInstance } from "../../../types"

/**
 * 验证 compiler 直接创建节点，并保留配置 token 缓存语义。
 */
describe("createCompile().createNode", () => {
  it("编译已在边界规范化的字段", () => {
    const compile = createCompile({ defaultRendererType: "input" })

    const schema = { name: "email", label: "" } as SchemxField

    const normalized = normalizeSchemas([schema], "input")

    const node = compile.createNode(normalized[0], "", 0)

    expect(node).toMatchObject({
      type: "field",
      key: "field:email",
    })

    expect(isFieldNode(node) && node.staticSchema.value.componentType).toBe("input")
    expect(schema).not.toHaveProperty("componentType")
  })

  it("按 Renderer 默认值、字段 Props 和 Core 受控状态编译组件 Props", () => {
    const formInstance = { id: "form" } as unknown as SchemxInstance

    const rendererOnChange = () => undefined

    const compile = createCompile({
      formInstance,
      rendererProps: {
        input: {
          align: "left",
          disabled: true,
          onChange: rendererOnChange,
          placeholder: "Renderer 占位",
          readonly: false,
          readonlyPlaceholder: "Renderer 空值",
        },
      },
    })

    const node = compile.createNode(
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
        readonly: true,
        disabled: false,
        componentProps: {
          align: "center",
          placeholder: "字段占位",
          readonlyPlaceholder: "字段空值",
        },
      },
      "",
      0
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.staticSchema.value.componentProps).toMatchObject({
      align: "right",
      disabled: false,
      onChange: rendererOnChange,
      placeholder: "字段占位",
      readonly: true,
      readonlyPlaceholder: "字段空值",
      formInstance,
      formItemProps: {
        name: "email",
        placeholder: "字段占位",
        readonly: true,
        disabled: false,
      },
    })

    const topLevelNode = compile.createNode(
      {
        name: "nickname",
        label: "昵称",
        componentType: "input",
        contentAlign: "center",
        placeholder: "顶层字段占位",
        readonlyPlaceholder: "顶层字段空值",
      },
      "",
      1
    )

    if (!isFieldNode(topLevelNode)) {
      throw new Error("expected field node")
    }

    expect(topLevelNode.staticSchema.value.componentProps).toMatchObject({
      align: "center",
      placeholder: "顶层字段占位",
      readonlyPlaceholder: "顶层字段空值",
    })
  })

  it("只按 Schema 的精确 componentType 读取 Renderer 默认 Props", () => {
    const compile = createCompile({
      defaultRendererType: "text",
      rendererProps: {
        text: { placeholder: "fallback 占位" },
        unknown: { placeholder: "精确占位" },
      },
    })

    const node = compile.createNode(
      {
        name: "custom",
        label: "自定义",
        componentType: "unknown",
      },
      "",
      0
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.staticSchema.value.componentType).toBe("unknown")
    expect(node.staticSchema.value.componentProps?.placeholder).toBe("精确占位")
  })

  it("编译 group 时不持有子树", () => {
    const compile = createCompile()

    const schema = {
      label: "基本信息",
      children: [{ name: "name", label: "姓名", componentType: "input" }],
    } as SchemxField

    const node = compile.createNode(schema, "", 0)

    expect(node.type).toBe("group")
    expect(node).not.toHaveProperty("children")
    if (!isGroupNode(node)) {
      throw new Error("expected group node")
    }

    expect(node.staticSchema.value.children).toEqual([])
  })

  it("编译 dependency 时封装 renderer 与触发字段", () => {
    const compile = createCompile()

    const node = compile.createNode(
      { to: ["mode"], renderer: () => [] } as SchemxField,
      "",
      0
    )

    expect(node).toMatchObject({ type: "dependency" })
    if (!isDependencyNode(node)) {
      throw new Error("expected dependency node")
    }

    expect(node.staticSchema.value.to).toEqual(["mode"])
  })

  it("相同 schema 与最终节点 key 复用配置 token但创建新节点", () => {
    const compile = createCompile()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.createNode(schema, "", 0)

    const second = compile.createNode(schema, "", 0)

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("稳定 key 的字段重排后复用节点输入", () => {
    const compile = createCompile()

    const schema = {
      key: "email",
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.createNode(schema, "", 0)

    const second = compile.createNode(schema, "", 1)

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("失效缓存后生成新的配置 token", () => {
    const compile = createCompile()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.createNode(schema, "", 0)

    compile.invalidate()

    const second = compile.createNode(schema, "", 0)

    expect(second).not.toBe(first)
    expect(second.configToken).not.toBe(first.configToken)
  })
})
