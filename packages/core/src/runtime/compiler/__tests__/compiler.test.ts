import { describe, expect, it } from "vitest"

import {
  isDependencyNode,
  isDynamicNode,
  isFieldNode,
  isGroupNode,
} from "../../node/helper"
import { createCompile, createSchemaCompiler } from "../index"

import type { SchemxField } from "../../../types"

/**
 * 验证 compiler 直接创建节点，并保留配置 token 缓存语义。
 */
describe("createSchemaCompiler().createNode", () => {
  it("编译字段", () => {
    const compiler = createSchemaCompiler()

    const node = compiler.createNode(
      { name: "email", label: "", componentType: "input" },
      "",
      0
    )

    expect(node).toMatchObject({
      type: "field",
      key: "field:email",
    })

    expect(isFieldNode(node) && node.compiledSchema.value.componentType).toBe("input")
  })

  it("通用继承 schemaConfig 并保留字段显式配置", () => {
    const compiler = createSchemaCompiler({
      schemaConfig: {
        visible: false,
        readonly: true,
        disabled: true,
        required: true,
        labelAlign: "right",
        labelPosition: "top",
        labelWidth: "160px",
        contentAlign: "center",
        colon: false,
        showRequiredMark: false,
        validationTrigger: "onChange",
      },
    })

    const node = compiler.createNode(
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
        visible: true,
        readonly: false,
        disabled: undefined,
        labelWidth: "",
      },
      "",
      0
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.compiledSchema.value).toMatchObject({
      visible: true,
      readonly: false,
      disabled: true,
      required: true,
      labelAlign: "right",
      labelPosition: "top",
      labelWidth: "",
      contentAlign: "center",
      colon: false,
      showRequiredMark: false,
      validationTrigger: ["change"],
    })
  })

  it("按 Renderer 默认值、字段 Props 和 Core 受控状态编译组件 Props", () => {
    const formInstance = { id: "form" } as any

    const compiler = createSchemaCompiler({
      formInstance,
      rendererProps: {
        input: {
          disabled: true,
          placeholder: "Renderer 占位",
          readonly: false,
          readonlyPlaceholder: "Renderer 空值",
        },
      },
    })

    const node = compiler.createNode(
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
        readonly: true,
        disabled: false,
        componentProps: {
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

    expect(node.compiledSchema.value.componentProps).toMatchObject({
      disabled: false,
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

    const topLevelNode = compiler.createNode(
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

    expect(topLevelNode.compiledSchema.value.componentProps).toMatchObject({
      placeholder: "顶层字段占位",
      readonlyPlaceholder: "顶层字段空值",
    })
  })

  it("只按 Schema 的精确 componentType 读取 Renderer 默认 Props", () => {
    const compiler = createSchemaCompiler({
      rendererProps: {
        text: { placeholder: "fallback 占位" },
        unknown: { placeholder: "精确占位" },
      },
    })

    const node = compiler.createNode(
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

    expect(node.compiledSchema.value.componentType).toBe("unknown")
    expect(node.compiledSchema.value.componentProps?.placeholder).toBe("精确占位")
  })

  it("编译 group 时不持有子树", () => {
    const compiler = createSchemaCompiler()

    const schema = {
      label: "基本信息",
      children: [{ name: "name", label: "姓名", componentType: "input" }],
    } as SchemxField

    const node = compiler.createNode(schema, "", 0)

    expect(node.type).toBe("group")
    expect(node).not.toHaveProperty("children")
    if (!isGroupNode(node)) {
      throw new Error("expected group node")
    }

    expect(node.compiledSchema.value.children).toEqual([])
  })

  it("编译 dependency 时封装 renderer 与触发字段", () => {
    const compiler = createSchemaCompiler()

    const node = compiler.createNode(
      { to: ["mode"], renderer: () => [] } as SchemxField,
      "",
      0
    )

    expect(node).toMatchObject({ type: "dependency" })
    if (!isDependencyNode(node)) {
      throw new Error("expected dependency node")
    }

    expect(node.compiledSchema.value.to).toEqual(["mode"])
  })

  it("四类 Node 的 canonical 状态与弃用别名共享同一 Signal", () => {
    const compiler = createSchemaCompiler()

    const field = compiler.createNode(
      { name: "field", label: "字段", componentType: "input" },
      "",
      0
    )

    const group = compiler.createNode({ label: "分组", children: [] }, "", 1)

    const dependency = compiler.createNode(
      { to: ["field"], renderer: () => [] } as SchemxField,
      "",
      2
    )

    const dynamic = compiler.createNode(
      {
        key: "items",
        name: "items",
        label: "数组",
        item: [],
      } as SchemxField,
      "",
      3
    )

    if (!isFieldNode(field) || !isGroupNode(group) || !isDependencyNode(dependency)) {
      throw new Error("expected Field, Group and Dependency nodes")
    }

    if (!isDynamicNode(dynamic)) {
      throw new Error("expected Dynamic node")
    }

    expect(field.staticSchema).toBe(field.compiledSchema)
    expect(field.dynamicOverrides).toBe(field.dependencyOverrides)
    expect(field.effectiveSchema).toBe(field.resolvedSchema)
    expect(field.validationSchema).toBe(field.validationState)

    for (const node of [group, dependency, dynamic]) {
      expect(node.staticSchema).toBe(node.compiledSchema)
      expect(node.dynamicOverrides).toBe(node.dependencyOverrides)
      expect(node.effectiveState).toBe(node.presentationState)
    }
  })

  it("相同 schema 与最终节点 key 复用配置 token但创建新节点", () => {
    const compiler = createSchemaCompiler()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(schema, "", 0)

    const second = compiler.createNode(schema, "", 0)

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("稳定 key 的字段重排后复用节点输入", () => {
    const compiler = createSchemaCompiler()

    const schema = {
      key: "email",
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(schema, "", 0)

    const second = compiler.createNode(schema, "", 1)

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("失效缓存后生成新的配置 token", () => {
    const compiler = createSchemaCompiler()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(schema, "", 0)

    compiler.invalidateConfigCache()

    const second = compiler.createNode(schema, "", 0)

    expect(second).not.toBe(first)
    expect(second.configToken).not.toBe(first.configToken)
  })

  it("保留 createCompile 和 invalidate 的兼容别名", () => {
    expect(createCompile).toBe(createSchemaCompiler)

    const compiler = createCompile()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(schema, "", 0)

    compiler.invalidate()

    const second = compiler.createNode(schema, "", 0)

    expect(second.configToken).not.toBe(first.configToken)
  })
})
