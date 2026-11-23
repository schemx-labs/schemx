/**
 * View 模块统一导出。
 *
 * 提供 ViewSchema 类型、构建、订阅和 adapter 工具。
 *
 * @module core/view
 */

export { buildViewSchemas } from "./buildViewSchemas"

export { subscribeViewSchemas } from "./subscribeViewSchemas"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  SchemxRendererKey as ViewRendererKey,
} from "./types"

export { createViewRevision, type ViewRevision } from "./viewRevision"
