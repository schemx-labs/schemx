/**
 * schema 列配置工具单元测试
 *
 * 覆盖 Raw/Resolved Schema 结构分类和 findSchema 递归查找。
 *
 * @module utils/__tests__/schema
 */
import { describe, expect, it } from "vitest"

import {
  findSchema,
  getSchemaKind,
  isBaseSchema,
  isBaseResolvedSchema,
  isDependencySchema,
  isGroupSchema,
  isGroupResolvedSchema,
} from "../schema"

import type { SchemxField, SchemxResolvedField } from "../../types"

const baseField: SchemxField = {
  name: "username",
  label: "用户名",
  componentType: "text",
}

const groupField: SchemxField = {
  label: "基本信息",
  children: [baseField],
}

const dependencyField: SchemxField = {
  to: ["username"],
  renderer: () => [],
}

describe("getSchemaKind", () => {
  it("按结构识别普通字段、Group 和 Dependency", () => {
    expect(getSchemaKind(baseField)).toBe("field")
    expect(getSchemaKind(groupField)).toBe("group")
    expect(getSchemaKind(dependencyField)).toBe("dependency")
  })

  it("children 优先于其他结构属性识别为 Group", () => {
    expect(getSchemaKind({ ...baseField, children: [] })).toBe("group")
    expect(getSchemaKind({ ...dependencyField, label: "依赖分组", children: [] })).toBe(
      "group"
    )
  })

  it("无容器结构属性时识别为普通字段", () => {
    expect(getSchemaKind({ label: "未知" } as never)).toBe("field")
  })

  it("to 或 renderer 任一存在时识别为 Dependency", () => {
    expect(getSchemaKind({ to: ["username"] } as never)).toBe("dependency")
    expect(getSchemaKind({ renderer: () => [] } as never)).toBe("dependency")
  })
})

describe("Raw Schema 类型守卫", () => {
  it("分别收窄普通字段、Group 和 Dependency", () => {
    expect(isBaseSchema(baseField)).toBe(true)
    expect(isGroupSchema(groupField)).toBe(true)
    expect(isDependencySchema(dependencyField)).toBe(true)
  })
})

describe("Resolved Schema 类型守卫", () => {
  const resolvedBase = baseField as SchemxResolvedField
  const resolvedGroup = groupField as SchemxResolvedField

  it("通过 children 区分 Group 与普通字段", () => {
    expect(isBaseResolvedSchema(resolvedBase)).toBe(true)
    expect(isBaseResolvedSchema(resolvedGroup)).toBe(false)
    expect(isGroupResolvedSchema(resolvedGroup)).toBe(true)
    expect(isGroupResolvedSchema(resolvedBase)).toBe(false)
  })
})

describe("findSchema", () => {
  it("平铺 schemas 中按名称查找", () => {
    const schemas: SchemxField[] = [baseField]
    expect(findSchema(schemas, "username")).toBe(baseField)
  })

  it("group 嵌套中递归查找", () => {
    const schemas: SchemxField[] = [groupField]
    expect(findSchema(schemas, "username")).toBe(baseField)
  })

  it("不存在的字段名返回 undefined", () => {
    const schemas: SchemxField[] = [baseField, groupField]
    expect(findSchema(schemas, "nonexistent")).toBeUndefined()
  })
})
