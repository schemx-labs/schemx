/**
 * Vue Runtime 的内部统一入口。
 *
 * 该目录消费 Core 的 `FormStateAdapter`，并将快照投影为 Vue Instance、字段
 * 状态和 ViewSchema 状态。除 `VueSchemxInstance` 外不形成
 * 包根公开 API。
 *
 * @module vue/bridge
 */

export { acquireVueFormRuntime, useVueFormRuntime } from "./formBridge"
export { getVueFieldState } from "./fieldBridge"
export type { VueFieldState, VueFormRuntime, VueSchemxInstance } from "./types"
