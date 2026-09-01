/**
 * 响应式模块。
 *
 * 提供细粒度响应式能力，包括 signal、effect、computed 和批量更新。
 * 这是 SchemaForm 的基础层，支撑字段状态、依赖追踪和动态属性计算。
 *
 * @module core/reactivity
 */

export {
  createSignal,
  type DeepReadonlySignal,
  type ReadonlySignal,
  type Signal,
  type SignalOptions,
} from "./signal"

export {
  createSignalEffect,
  runSignalUntracked,
  type SignalEffectOptions,
  type SignalEffectDispose,
} from "./effect"

export {
  type SignalWatchOptions,
  type DebouncedSignalWatchOptions,
  type DebouncedSignalWatchControls,
  createSignalWatch,
  createDebouncedSignalWatch,
} from "./watch"

export { batchUpdates, onBatchComplete } from "./batch"

export { createComputed, type ComputedSignal } from "./computed"
