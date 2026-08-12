import { describe, expect, it } from "vitest"

import { normalizeSchemas } from "../../../utils"
import { createCompile } from "../index"

import type { SchemxField, SchemxInstance } from "../../../types"

/** 验证 compiler 只输出当前节点输入，并保留缓存语义。 */
describe("createCompile().compileNode", () => {
  it("编译已在边界规范化的字段", () => {
    const compile = createCompile({ defaultRendererType: "input" })

    const schema = { name: "email", label: "" } as SchemxField

    const normalized = normalizeSchemas([schema], "input")

    const input = compile.compileNode(normalized[0], "", 0)

    expect(input).toMatchObject({
      type: "field",
      key: "field:email",
      componentType: "input",
    })
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

    const input = compile.compileNode(
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

    if (input.type !== "field") {
      throw new Error("expected field node input")
    }

    expect(input.staticSchema.componentProps).toMatchObject({
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

    const topLevelInput = compile.compileNode(
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

    if (topLevelInput.type !== "field") {
      throw new Error("expected field node input")
    }

    expect(topLevelInput.staticSchema.componentProps).toMatchObject({
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

    const input = compile.compileNode(
      {
        name: "custom",
        label: "自定义",
        componentType: "unknown",
      },
      "",
      0
    )

    if (input.type !== "field") {
      throw new Error("expected field node input")
    }

    expect(input.staticSchema.componentType).toBe("unknown")
    expect(input.staticSchema.componentProps?.placeholder).toBe("精确占位")
  })

  it("编译 group 时不持有子树", () => {
    const compile = createCompile()

    const schema = {
      label: "基本信息",
      children: [{ name: "name", label: "姓名", componentType: "input" }],
    } as SchemxField

    const input = compile.compileNode(schema, "", 0)

    expect(input.type).toBe("group")
    expect(input).not.toHaveProperty("children")
    if (input.type !== "group") {
      throw new Error("expected group node input")
    }

    expect(input.staticSchema.children).toEqual([])
  })

  it("编译 dependency 时封装 renderer 与触发字段", () => {
    const compile = createCompile()

    const input = compile.compileNode(
      { to: ["mode"], renderer: () => [] } as SchemxField,
      "",
      0
    )

    expect(input).toMatchObject({
      type: "dependency",
      triggerFields: ["mode"],
    })
  })

  it("相同 schema 与最终节点 key 复用节点输入", () => {
    const compile = createCompile()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.compileNode(schema, "", 0)

    const second = compile.compileNode(schema, "", 0)

    expect(second).toBe(first)
  })

  it("稳定 key 的字段重排后复用节点输入", () => {
    const compile = createCompile()

    const schema = {
      key: "email",
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.compileNode(schema, "", 0)

    const second = compile.compileNode(schema, "", 1)

    expect(second).toBe(first)
  })

  it("失效缓存后生成新的节点输入", () => {
    const compile = createCompile()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compile.compileNode(schema, "", 0)

    compile.invalidate()

    expect(compile.compileNode(schema, "", 0)).not.toBe(first)
  })
})
