/**
 * Schema 标准化工具
 *
 * 标准化 schema 配置，移除必填项未填的配置，并在控制台输出警告信息。
 *
 * @module utils/normalize
 */

import { isBaseSchema, isDependencySchema, isGroupSchema } from "./schema"

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"

/**
 * 检查 label 是否合法
 * @param schema
 * @returns boolean
 */
const isLegalName = <T extends Values>(schema: SchemxBaseField<T>) =>
  Object.hasOwn(schema, "name") && [null, undefined, ""].every((i) => i !== schema.name)

/**
 * 检查 componentType 是否合法
 * @param schema
 * @returns boolean
 */
const isLegalComponentType = <T extends Values>(schema: SchemxField<T>) =>
  Object.hasOwn(schema, "componentType") && typeof schema.componentType === "string"

/**
 * 校验基础字段的必填项是否完整
 *
 * 基础字段必须包含 name、label、componentType 三个字段。
 *
 * @param schema - 基础字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getBaseFieldMissing<T extends Values>(schema: SchemxBaseField<T>): string[] {
  const missing: string[] = []

  if (!isLegalName(schema)) missing.push("name")

  if (!isLegalComponentType(schema)) missing.push("componentType")

  return missing
}

/**
 * 校验分组字段的必填项是否完整
 *
 * 分组字段必须包含 label、componentType、children 三个字段。
 *
 * @param schema - 分组字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getGroupFieldMissing<T extends Values>(schema: SchemxGroupField<T>): string[] {
  const missing: string[] = []

  if (!isLegalComponentType(schema)) missing.push("componentType")

  if (!Object.hasOwn(schema, "children") || !Array.isArray(schema.children))
    missing.push("children")

  return missing
}

/**
 * 校验依赖字段的必填项是否完整
 *
 * 依赖字段必须包含 componentType、to、renderer 三个字段。
 *
 * @param schema - 依赖字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getDependencyFieldMissing<T extends Values>(
  schema: SchemxDependencyField<T>
): string[] {
  const missing: string[] = []

  if (!isLegalComponentType(schema)) missing.push("componentType")

  if (!Object.hasOwn(schema, "to") || !Array.isArray(schema.to)) missing.push("to")

  if (typeof schema.renderer !== "function") missing.push("renderer")

  return missing
}

/**
 * 构建警告信息
 *
 * @param index - schema 在数组中的索引
 * @param schema - 字段配置
 * @param missing - 缺失的字段名数组
 * @returns 格式化的警告信息
 */
function buildWarnMessage<T extends Values>(
  index: number,
  schema: SchemxField<T>,
  missing: string[]
): string {
  const identifier =
    ("name" in schema && schema.name) || schema.componentType || "unknown"

  return (
    `[schemx] schemas[${index}] (${String(identifier)}) ` +
    `缺少必填项: ${missing.join(", ")}，已被过滤`
  )
}

/**
 * 过滤 schemas 数组，移除必填项未填的配置
 *
 * 对基础字段、分组字段、依赖字段分别校验其必填项，
 * 不合格的条目会被过滤掉并在控制台输出 warn 信息。
 * 分组字段的 children 会递归过滤。
 *
 * @typeParam T - 表单值类型
 * @param schemas - 原始 schema 配置数组
 * @returns 过滤后的 schema 配置数组
 *
 * @example
 * ```ts
 * const cleaned = normalizeSchemas([
 *   { name: '', label: '用户名', componentType: 'input' },  // name 为空，被过滤
 *   { name: 'email', label: '邮件', componentType: '' },  // componentType 为空，被过滤
 *   { componentType: 'group', label: '分组', children: [] },
 * ])
 * ```
 */
export function normalizeSchemas<T extends Values = Values>(
  schemas: SchemxField<T>[]
): SchemxField<T>[] {
  const result: SchemxField<T>[] = []
  const missings: string[] = []

  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i]
    let missing: string[] = []

    if (isGroupSchema(schema)) {
      missing = getGroupFieldMissing(schema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        continue
      }

      // 递归过滤 children
      result.push({
        ...schema,
        children: normalizeSchemas<T>(schema.children as SchemxField<T>[]),
      })
    } else if (isDependencySchema(schema)) {
      missing = getDependencyFieldMissing(schema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        continue
      }

      result.push(schema)
    } else if (isBaseSchema(schema)) {
      missing = getBaseFieldMissing(schema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        continue
      }

      result.push(schema)
    }
  }

  if (missings.length) console.warn(missings.join("\n"))

  return result
}
