/**
 * 响应式模块。
 *
 * 提供细粒度响应式能力，包括 signal、effect 和批量更新。
 * 这是 SchemaForm 的基础层，支撑字段状态、依赖追踪和动态属性计算。
 *
 * @module core/reactivity
 */

export {
  Signal,
  createSignal,
  type DeepReadonlySignal,
  type ReadonlySignal,
  type SignalOptions,
} from "./signal"

export { createFieldSignal, type FieldSignal } from "./fieldSignal"

export {
  createFieldSignalMap,
  type FieldSignalMap,
  type FieldSignalMapOptions,
} from "./fieldSignalMap"

export {
  createSignalEffect,
  createDebouncedSignalEffect,
  type DebouncedSignalEffectOptions,
  type SignalEffectDispose,
} from "./effect"

export { batchUpdates } from "./batch"

export { createSignalMap, type SignalMap } from "./signalMap"
