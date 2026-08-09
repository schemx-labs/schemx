/**
 * View 模块统一导出。
 *
 * 提供 ViewSchema 类型、computed viewState 的创建/更新/删除、
 * ViewSchemas 订阅和运行时 adapter 工具。
 *
 * @module core/runtime/view
 */
export { subscribeViewSchemas } from "./subscribeViewSchemas"

export { isSchemxViewFieldSchema, isViewGroupSchema } from "./helper"

export {
  createRuntimeViewState,
  createRootRuntimeViewState,
  deleteRuntimeViewState,
  type FieldNodeViewState,
  type GroupViewState,
  type DependencyViewState,
  type RootViewState,
} from "./createViewState"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  SchemxRendererKey as ViewRendererKey,
} from "./types"
