/**
 * View 模块统一导出。
 *
 * 提供 ViewSchema 类型、computed ViewSchema 的创建/清理、
 * ViewSchemas 订阅和运行时 adapter 工具。
 *
 * @module core/runtime/view
 */
export { subscribeViewSchemas } from "./subscribeViewSchemas"

export { isSchemxViewFieldSchema, isViewDynamicSchema, isViewGroupSchema } from "./helper"

export type {
  SchemxViewDebugMeta,
  SchemxViewDynamicItem,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
