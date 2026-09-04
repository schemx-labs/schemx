/**
 * ViewSchema 类型守卫。
 *
 * 为渲染层区分字段与分组视图 schema，避免重复结构判断。
 *
 * @module core/runtime/view/helper
 */

import type {
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { Values } from "../../types"

/**
 * 判断 ViewSchema 是否为含子节点的分组。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 要检查的 ViewSchema。
 * @returns schema 是分组 ViewSchema 时返回 `true`。
 */
export function isViewGroupSchema<TValues extends Values = Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewGroupSchema<TValues> {
  return !isViewDynamicSchema(schema) && "children" in schema
}

/**
 * 判断 ViewSchema 是否为 Dynamic 数组容器。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 要检查的 ViewSchema。
 * @returns schema 是 Dynamic ViewSchema 时返回 `true`。
 */
export function isViewDynamicSchema<TValues extends Values = Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewDynamicSchema<TValues> {
  return "items" in schema
}

/**
 * 判断 ViewSchema 是否为可直接交给 Renderer 的字段。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 要检查的 ViewSchema。
 * @returns schema 是字段 ViewSchema 时返回 `true`。
 */
export function isSchemxViewFieldSchema<TValues extends Values = Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewFieldSchema<TValues> {
  return !isViewGroupSchema(schema) && !isViewDynamicSchema(schema)
}
