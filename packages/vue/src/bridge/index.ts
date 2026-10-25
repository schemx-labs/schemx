/**
 * Vue Runtime 的内部统一入口。
 *
 * 该目录直接消费 Core 原生只读状态，并将快照投影为 Vue Instance、字段
 * 状态和 ViewSchema 状态，不形成包根公开 API。
 *
 * @module vue/bridge
 */

// 分别供显式管理 owner 和绑定当前 Vue scope 的内部消费者使用。
export { acquireVueFormRuntime, useVueFormRuntime } from "./formBridge"
// 桥接内部的实例、状态与视图组装能力统一从本入口引用。
export { createVueFormInstance } from "./formInstance"
export { createVueStateBridge } from "./stateBridge"
export { createVueViewSchemaState } from "./viewSchemaBridge"
// 字段滚动实现由消费端注册，实例包装层只负责分发。
export {
  createVueScrollToFieldDispatcher,
  registerVueScrollToFieldHandler,
} from "./scrollToField"

// 原生状态的 Vue 外壳与字段投影契约。
export type {
  VueBoundFieldState,
  VueFieldState,
  VueStateBridge,
  VueStateRef,
} from "./stateBridge"
// Runtime 资源与追踪契约仅作为 Vue 包内的模块出口。
export type {
  PendingFieldsSnapshot,
  VueFieldDependency,
  VueFormDependency,
  VueFormResources,
  VueFormRuntime,
  VueSchemxInstance,
  VueViewSchemaState,
} from "./types"
// 挂载组件提供的字段滚动处理契约。
export type { VueScrollToFieldHandler } from "./scrollToField"
