/**
 * 框架无关的 reactive signal 门面。
 *
 * 这里完整暴露 `@preact/signals-core` 中 plain signal 的能力，同时保留
 * core 内部已经使用的 `createSignal` 命名。也就是说，调用方既能把它当作
 * 简单的 `{ value, peek() }` 使用，也能使用 signals-core 原生支持的：
 *
 * - `subscribe(fn)` 手动订阅
 * - `name` / `SignalOptions.name` 调试名称
 * - `watched` / `unwatched` 生命周期回调
 * - `valueOf()` / `toString()` / `toJSON()` 值转换
 * - `brand` 标识
 *
 * core 其他模块仍然只从本文件导入类型和工厂，避免直接耦合底层包路径。
 *
 * @module core/reactivity/signal
 */

import { signal, Signal } from "@preact/signals-core"

import type { DeepReadonly } from "../types/utils"
import type { ReadonlySignal, SignalOptions } from "@preact/signals-core"

/**
 * 深层只读响应式 signal 类型。
 *
 * `DeepSignalReadonly<T>` 表示一个整体上仍然是 readonly signal 的值，
 * 且 `.value` 会通过 `DeepReadonly<T>` 暴露为深层只读数据；同时在对象、
 * 数组或 tuple 的子节点上暴露递归的只读 signal 视图。它是纯类型工具，
 * 不创建运行时代理，也不改变 `createSignal` 的行为。
 *
 * @example
 * ```typescript
 * type UserSignal = DeepSignalReadonly<{
 *   name: string
 *   profile: { age: number }
 * }>
 *
 * declare const user: UserSignal
 *
 * user.value              // DeepReadonly<{ name: string; profile: { age: number } }>
 * user.name.value         // string
 * user.profile.age.value  // number
 * ```
 *
 * @typeParam T - 原始值类型
 */
export type DeepReadonlySignal<T> = ReadonlySignal<DeepReadonly<T>>

/**
 * 创建 reactive signal。
 *
 * @typeParam T - signal 值类型
 * @param value - 初始值
 * @param options - signals-core 原生 signal 配置
 * @returns 可写 reactive signal
 */
export function createSignal<T>(value: T, options?: SignalOptions<T>): Signal<T>

/**
 * 创建初始值为 undefined 的 reactive signal。
 *
 * @typeParam T - signal 值类型
 * @param value - 可选初始值
 * @param options - signals-core 原生 signal 配置
 * @returns 可写 reactive signal
 */
export function createSignal<T = undefined>(
  value?: T,
  options?: SignalOptions<T | undefined>
): Signal<T | undefined>

/**
 * `createSignal` overload 的运行时实现。
 *
 * @param value - 可选初始值。
 * @param options - signals-core 原生 signal 配置。
 * @returns 可写 reactive signal。
 */
export function createSignal<T>(
  value?: T,
  options?: SignalOptions<T | undefined>
): Signal<T | undefined> {
  return signal(value, options)
}

export { Signal }
export type { SignalOptions, ReadonlySignal }
