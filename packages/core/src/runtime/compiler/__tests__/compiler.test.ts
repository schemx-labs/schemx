import { describe, expect, it } from "vitest"

import { normalizeSchemas } from "../../../utils"
import { createCompile } from "../index"

import type { SchemxField } from "../../../types"

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
