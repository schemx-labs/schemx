/**
 * schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 schemx 的列配置解析。
 *
 * @module utils/schema
 */

import { createFieldKey } from "./path"

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"

/**
 * Schema 的结构类型。
 */
export type SchemaKind = "field" | "group" | "dependency" | "dynamic"

/**
 * 按结构属性识别 Schema 类型。
 *
 * 同时包含稳定 `key`、`name` 和 `item` 时识别为 Dynamic；其后是普通 Group
 * 的 `children`，再其次是 `to` 或 `renderer`；没有容器结构属性时视为普通字段。
 * 该函数只负责分类，字段完整性由编译阶段校验。
 *
 * @param schema - 待识别的未知 Schema。
 * @returns Schema 的结构类型。
 *
 * @example
 * ```ts
 * getSchemaKind({ name: "email", label: "邮箱" }) // => "field"
 * getSchemaKind({ label: "资料", children: [] }) // => "group"
 * getSchemaKind({ children: [], to: ["type"] }) // => "group"
 * ```
 */
export function getSchemaKind<TValues extends Values = Values>(
  schema: SchemxField | SchemxField<TValues>
): SchemaKind {
  if (
    typeof schema === "object" &&
    typeof schema.key === "string" &&
    Object.hasOwn(schema, "name") &&
    Object.hasOwn(schema, "item")
  ) {
    return "dynamic"
  }

  if (Object.hasOwn(schema, "children")) {
    return "group"
  }

  if (Object.hasOwn(schema, "to") || Object.hasOwn(schema, "renderer")) {
    return "dependency"
  }

  return "field"
}

/**
 * 类型守卫：判断是否为 Dynamic 数组字段配置。
 *
 * Dynamic 必须同时提供非空稳定 key、数组 name 和 item 模板；该结构与
 * Group 的 `children` 通过 `name` 区分。
 *
 * @param schema - 列配置。
 * @returns 是否为 Dynamic Schema。
 *
 * @example
 * ```ts
 * if (isDynamicSchema(schema)) {
 *   console.log(schema.name, schema.item)
 * }
 * ```
 */
export function isDynamicSchema<TValues extends Values = Values>(
  schema: SchemxField<TValues>
): schema is SchemxDynamicField<TValues> {
  return (
    typeof schema === "object" &&
    typeof schema.key === "string" &&
    schema.key.length > 0 &&
    Object.hasOwn(schema, "name") &&
    typeof (schema as { name?: unknown }).name === "string" &&
    Object.hasOwn(schema, "item") &&
    Array.isArray((schema as { item?: unknown }).item)
  )
}

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 不包含 `children`、`item`、`to` 或 `renderer` 的 Schema 按普通字段处理。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 *
 * @example
 * ```ts
 * const schemas = [
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   { label: '资料', children: [...] },
 *   { to: ['type'], renderer: () => [...] }
 * ]
 *
 * schemas.forEach(schema => {
 *   if (isFieldSchema(schema)) {
 *     // TypeScript 现在知道这是 SchemxBaseField
 *     console.log('基础字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isFieldSchema<TValues extends Values = Values>(
  schema: SchemxField<TValues>
): schema is SchemxBaseField<TValues> {
  return getSchemaKind(schema) === "field"
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为包含 `children` 的分组 Schema
 *
 * @example
 * ```ts
 * const schema = {
 *   label: '资料',
 *   children: [
 *     { name: 'name', label: '姓名', componentType: 'input' },
 *     { name: 'age', label: '年龄', componentType: 'number' }
 *   ]
 * }
 *
 * if (isGroupSchema(schema)) {
 *   // TypeScript 现在知道这是 SchemxGroupField
 *   schema.children.forEach(child => {
 *     console.log('子字段:', child)
 *   })
 * }
 * ```
 */
export function isGroupSchema<TValues extends Values = Values>(
  schema: SchemxField<TValues>
): schema is SchemxGroupField<TValues> {
  return getSchemaKind(schema) === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param schema - 列配置
 * @returns 是否为包含 `to` 和 `renderer` 结构标记的 Dependency Schema
 *
 * @example
 * ```ts
 * const schema = {
 *   to: ['type'],
 *   renderer: (values) => {
 *     if (values.type === 'A') {
 *       return [{ name: 'fieldA', componentType: 'input' }]
 *     }
 *     return [{ name: 'fieldB', componentType: 'input' }]
 *   }
 * }
 *
 * if (isDependencySchema(schema)) {
 *   // TypeScript 现在知道这是 SchemxDependencyField
 *   const dynamicSchemas = schema.renderer({ type: 'A' }, form, context)
 * }
 * ```
 */
export function isDependencySchema<TValues extends Values = Values>(
  schema: SchemxField<TValues>
): schema is SchemxDependencyField<TValues> {
  return getSchemaKind(schema) === "dependency"
}

/**
 * 在列配置树中按字段名查找基础字段配置。
 *
 * 递归搜索 group、nested 的子 schemas，返回第一个匹配的基础字段。
 *
 * @param schemas - 列配置数组
 * @param name - 字段名称
 *
 * @returns 匹配的基础字段配置，未找到时返回 undefined
 *
 * @example
 * ```ts
 * const schemas = [
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   {
 *     label: '资料',
 *     children: [
 *       { name: 'email', label: '邮箱', componentType: 'input' }
 *     ]
 *   }
 * ]
 *
 * // 在顶层找到
 * const usernameSchema = findSchema(schemas, 'username')
 * console.log(usernameSchema?.label) // => '用户名'
 *
 * // 在 group 中递归找到
 * const emailSchema = findSchema(schemas, 'email')
 * console.log(emailSchema?.label) // => '邮箱'
 *
 * // 未找到
 * const notFound = findSchema(schemas, 'nonexistent')
 * console.log(notFound) // => undefined
 * ```
 */
export function findSchema<TValues extends Values = Values>(
  schemas: SchemxField<TValues>[],
  name: string
): SchemxBaseField<TValues> | undefined {
  for (const schema of schemas) {
    if (isFieldSchema(schema) && schema.name === name) {
      return schema
    }

    if (isGroupSchema(schema)) {
      const found = findSchema<TValues>(schema.children as SchemxField<TValues>[], name)

      if (found) return found
    }
  }

  return undefined
}

/**
 * 判断单个 Schema 及其静态子树是否满足运行时结构约束。
 *
 * Dynamic 模板只能包含 Field、Group 和 Dependency，且同一静态树内的字段名不能
 * 重复。该函数不补全默认渲染器，也不修改传入对象；缺少 `componentType` 的 Field
 * 因此视为不合规。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 待校验的未知 Schema 节点。
 * @returns Schema 及其静态子树是否合规。
 *
 * @example
 * ```ts
 * isValidSchema({ name: "email", label: "邮箱", componentType: "input" })
 * // => true
 * ```
 */
export function isValidSchema<TValues extends Values = Values>(schema: unknown): boolean {
  /** 记录结构错误并返回 false，保持标准化检查的无异常语义。 */
  const reportInvalid = (path: string, message: string): false => {
    const separator = message.startsWith(".") ? "" : " "

    console.error(`[schemx] ${path}${separator}${message}`)

    return false
  }

  /**
   * 校验节点并记录所属静态树中的字段名。
   *
   * @param candidate - 当前待检查的未知节点。
   * @param fieldNames - 当前静态树已出现的规范化字段名。
   * @param dynamicTemplate - 当前节点是否位于 Dynamic 数组项模板内。
   * @param path - 当前节点在 Schema 树中的路径。
   */
  const isValid = (
    candidate: unknown,
    fieldNames: Set<string>,
    dynamicTemplate: boolean,
    path: string
  ): boolean => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      return reportInvalid(path, "必须是对象")
    }

    const field = candidate as SchemxField<TValues>

    const record = candidate as Record<string, unknown>

    const kind = getSchemaKind(field)

    if (kind === "field") {
      if (typeof record.name !== "string" || record.name.length === 0) {
        return reportInvalid(path, ".name 必须是非空字符串")
      }

      if (typeof record.label !== "string") {
        return reportInvalid(path, ".label 必须是字符串")
      }

      if (typeof record.componentType !== "string" || record.componentType.length === 0) {
        return reportInvalid(path, ".componentType 必须是非空字符串")
      }

      const fieldKey = createFieldKey(record.name)

      if (fieldNames.has(fieldKey)) {
        return reportInvalid(path, `字段名 "${record.name}" 重复`)
      }

      fieldNames.add(fieldKey)

      return true
    }

    if (kind === "group") {
      if (record.componentType === "group") {
        return reportInvalid(path, '.componentType 不应为 "group"')
      }

      if (typeof record.label !== "string") {
        return reportInvalid(path, ".label 必须是字符串")
      }

      if (!Array.isArray(record.children)) {
        return reportInvalid(path, ".children 必须是数组")
      }

      return record.children.every((child, index) =>
        isValid(child, fieldNames, dynamicTemplate, `${path}.children[${index}]`)
      )
    }

    if (kind === "dynamic") {
      if (dynamicTemplate) {
        return reportInvalid(
          path,
          "只能包含 Field、Group 或 Dependency Schema，不能包含 Dynamic Schema"
        )
      }

      if (typeof record.key !== "string" || record.key.length === 0) {
        return reportInvalid(path, ".key 必须是非空字符串")
      }

      if (typeof record.name !== "string" || record.name.length === 0) {
        return reportInvalid(path, ".name 必须是非空字符串")
      }

      if (!Array.isArray(record.item)) {
        return reportInvalid(path, ".item 必须是数组")
      }

      const fieldKey = createFieldKey(record.name)

      if (fieldNames.has(fieldKey)) {
        return reportInvalid(path, `字段名 "${record.name}" 重复`)
      }

      fieldNames.add(fieldKey)

      const itemFieldNames = new Set<string>()

      return record.item.every((item, index) =>
        isValid(item, itemFieldNames, true, `${path}.item[${index}]`)
      )
    }

    if (kind === "dependency") {
      if (record.componentType === "dependency") {
        return reportInvalid(path, '.componentType 不应为 "dependency"')
      }

      if (
        !Array.isArray(record.to) ||
        record.to.length === 0 ||
        !record.to.every((name) => typeof name === "string" && name.length > 0)
      ) {
        return reportInvalid(path, ".to 必须是包含非空字符串的数组")
      }

      if (typeof record.renderer !== "function") {
        return reportInvalid(path, ".renderer 必须是函数")
      }

      return true
    }

    return reportInvalid(path, "类型无法识别")
  }

  return isValid(schema, new Set(), false, "schema")
}
