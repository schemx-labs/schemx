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
  SchemxField,
  SchemxGroupField,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  SchemxResolvedGroupField,
  Values,
} from "../types"

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 *
 * @example
 * ```ts
 * const schemas = [
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   { name: 'group', componentType: 'group', children: [...] },
 *   { name: 'dep', componentType: 'dependency', render: () => [...] }
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
export function isBaseSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxBaseField<T> {
  return !isGroupSchema(schema) && !isDependencySchema(schema)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 *
 * @example
 * ```ts
 * const schema = {
 *   name: 'profile',
 *   componentType: 'group',
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
export function isGroupSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxGroupField<T> {
  return schema.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "dependency"` 的依赖列
 *
 * @example
 * ```ts
 * const schema = {
 *   name: 'dynamic',
 *   componentType: 'dependency',
 *   render: ({ values }) => {
 *     if (values.type === 'A') {
 *       return [{ name: 'fieldA', componentType: 'input' }]
 *     }
 *     return [{ name: 'fieldB', componentType: 'input' }]
 *   }
 * }
 *
 * if (isDependencySchema(schema)) {
 *   // TypeScript 现在知道这是 SchemxDependencyField
 *   const dynamicSchemas = schema.render({ values: {} })
 * }
 * ```
 */
export function isDependencySchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxDependencyField<T> {
  return schema.componentType === "dependency"
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
 *     name: 'profile',
 *     componentType: 'group',
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
export function findSchema<T extends Values = Values>(
  schemas: SchemxField<T>[],
  name: string
): SchemxBaseField<T> | undefined {
  for (const schema of schemas) {
    if (isBaseSchema(schema) && schema.name === name) {
      return schema
    }

    if (isGroupSchema(schema)) {
      const found = findSchema<T>(schema.children as SchemxField<T>[], name)

      if (found) return found
    }
  }

  return undefined
}

/**
 * 类型守卫：判断是否为 序列化后的 基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 *
 * @example
 * ```ts
 * // 在处理 getViewSchemas 返回的解析后 schemas 时使用
 * const viewSchemas = form.getViewSchemas()
 *
 * viewSchemas.forEach(schema => {
 *   if (isBaseResolvedSchema(schema)) {
 *     console.log('基础字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isBaseResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxResolvedBaseField<T> {
  return !isGroupResolvedSchema(schema) && !isDependencyResolvedSchema(schema)
}

/**
 * 类型守卫：判断是否为 序列化后的 分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 *
 * @example
 * ```ts
 * const viewSchemas = form.getViewSchemas()
 *
 * viewSchemas.forEach(schema => {
 *   if (isGroupResolvedSchema(schema)) {
 *     // 递归处理子字段
 *     schema.children.forEach(child => {
 *       console.log('子字段:', child)
 *     })
 *   }
 * })
 * ```
 */
export function isGroupResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxResolvedGroupField<T> {
  return schema.componentType === "group"
}

/**
 * 类型守卫：判断是否为 dependency resolved schema。
 *
 * @param schema - 解析后的字段配置。
 * @returns componentType 为 dependency 时返回 true。
 *
 * @example
 * ```ts
 * const viewSchemas = form.getViewSchemas()
 *
 * viewSchemas.forEach(schema => {
 *   if (isDependencyResolvedSchema(schema)) {
 *     console.log('依赖字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isDependencyResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): boolean {
  return (schema as SchemxField<T>).componentType === "dependency"
}
