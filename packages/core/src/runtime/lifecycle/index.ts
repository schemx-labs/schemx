/**
 * 生命周期模块。
 *
 * 提供领域无关的生命周期事件总线。
 *
 * @module core/runtime/lifecycle
 */

export type { NodeLifecycleEmitter, NodeLifecycleHooks } from "./lifecycle"
export { createNodeLifecycleEmitter } from "./lifecycle"
