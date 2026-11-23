/**
 * 生命周期模块。
 *
 * 提供领域无关的生命周期事件总线。
 *
 * @module core/lifecycle
 */

export type {
  RuntimeNodeLifecycleHooks,
  LifecycleBus,
  LifecycleHooks,
  LifecycleListener,
  SchemxLifecycleHooks,
} from "./lifecycle"
export { createLifecycle, createLifecycleBus } from "./lifecycle"
