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
  isDependencySchema,
  isDynamicSchema,
  isGroupSchema,
} from "../schema"

import type { SchemxField } from "../../types"

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

const dynamicField: SchemxField = {
  key: "users-schema",
  name: "users",
  item: [],
}

describe("getSchemaKind", () => {
  it("按结构识别普通字段、Group、Dependency 和 Dynamic", () => {
    expect(getSchemaKind(baseField)).toBe("field")
    expect(getSchemaKind(groupField)).toBe("group")
    expect(getSchemaKind(dependencyField)).toBe("dependency")
    expect(getSchemaKind(dynamicField)).toBe("dynamic")
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
  it("分别收窄普通字段、Group、Dependency 和 Dynamic", () => {
    expect(isBaseSchema(baseField)).toBe(true)
    expect(isGroupSchema(groupField)).toBe(true)
    expect(isDependencySchema(dependencyField)).toBe(true)
    expect(isDynamicSchema(dynamicField)).toBe(true)

    expect(
      isDynamicSchema({
        key: "legacy-users-schema",
        name: "users",
        children: [],
      } as never)
    ).toBe(false)
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
