/**
 * schema 列配置工具单元测试
 *
 * 覆盖 Raw/Resolved Schema 结构分类和 findSchema 递归查找。
 *
 * @module utils/__tests__/schema
 */
import { describe, expect, it, vi } from "vitest"

import {
  findSchema,
  getSchemaKind,
  isDependencySchema,
  isDynamicSchema,
  isFieldSchema,
  isGroupSchema,
  isValidSchema,
} from "../schema"

import type { SchemxRuntimeSchema as SchemxField } from "../../types/runtimeSchema"

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
    expect(isFieldSchema(baseField)).toBe(true)
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

describe("isValidSchema", () => {
  it("接受合规的 Field、Group、Dynamic 和 Dependency Schema", () => {
    expect(isValidSchema({ name: "name", label: "姓名", componentType: "input" })).toBe(
      true
    )
    expect(
      isValidSchema({
        label: "资料",
        children: [{ name: "email", label: "邮箱", componentType: "input" }],
      })
    ).toBe(true)
    expect(
      isValidSchema({
        key: "users",
        name: "users",
        item: [{ name: "name", label: "姓名", componentType: "input" }],
      })
    ).toBe(true)
    expect(
      isValidSchema({
        to: ["type"],
        renderer: () => [],
      })
    ).toBe(true)
  })

  it("拒绝字段结构、重复路径和不允许的 Dynamic 嵌套", () => {
    expect(isValidSchema({ name: "name", label: "姓名", componentType: "" })).toBe(false)
    expect(
      isValidSchema({
        label: "资料",
        children: [
          { name: "email", label: "邮箱", componentType: "input" },
          { name: "email", label: "重复邮箱", componentType: "input" },
        ],
      })
    ).toBe(false)
    expect(
      isValidSchema({
        key: "users",
        name: "users",
        item: [
          { name: "email", label: "邮箱", componentType: "input" },
          { name: "email", label: "重复邮箱", componentType: "input" },
        ],
      })
    ).toBe(false)
    expect(
      isValidSchema({
        key: "users",
        name: "users",
        item: [
          {
            key: "nested-users",
            name: "users",
            item: [],
          },
        ],
      })
    ).toBe(false)
  })

  it("拒绝不完整的 Group、Dynamic 和 Dependency Schema", () => {
    expect(isValidSchema({ label: "资料", children: "invalid" })).toBe(false)
    expect(isValidSchema({ key: "", name: "users", item: [] })).toBe(false)
    expect(isValidSchema({ to: [], renderer: () => [] })).toBe(false)
    expect(isValidSchema({ to: ["type"], renderer: "invalid" })).toBe(false)
  })

  it("检查失败时输出带 Schema 路径的错误日志", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      expect(
        isValidSchema({
          label: "资料",
          children: [{ label: "缺少名称", componentType: "input" }],
        })
      ).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        "[schemx] schema.children[0].name 必须是非空字符串"
      )
    } finally {
      errorSpy.mockRestore()
    }
  })
})
