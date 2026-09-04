/**
 * schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 schemx 的列配置解析。
 *
 * @module utils/schema
 */

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
 *   if (isBaseSchema(schema)) {
 *     // TypeScript 现在知道这是 SchemxBaseField
 *     console.log('基础字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isBaseSchema<TValues extends Values = Values>(
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
    if (isBaseSchema(schema) && schema.name === name) {
      return schema
    }

    if (isGroupSchema(schema)) {
      const found = findSchema<TValues>(schema.children as SchemxField<TValues>[], name)

      if (found) return found
    }
  }

  return undefined
}
