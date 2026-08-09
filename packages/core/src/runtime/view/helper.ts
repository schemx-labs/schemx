/**
 * ViewSchema 类型守卫。
 *
 * 为渲染层区分字段与分组视图 schema，避免重复结构判断。
 *
 * @module core/runtime/view/helper
 */

import type { SchemxViewFieldSchema, SchemxViewGroupSchema, SchemxViewSchema } from "./types"
import type { Values } from "../../types"

/** 判断 ViewSchema 是否为含子节点的分组。 */
export function isViewGroupSchema<TValues extends Values = Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewGroupSchema<TValues> {
  return "children" in schema
}

/** 判断 ViewSchema 是否为可直接交给 Renderer 的字段。 */
export function isSchemxViewFieldSchema<TValues extends Values = Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewFieldSchema<TValues> {
  return !isViewGroupSchema(schema)
}
