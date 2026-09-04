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

import { signal } from "@preact/signals-core"

import type { ReadonlySignal, Signal, SignalOptions } from "@preact/signals-core"

/**
 * 创建 reactive signal。
 *
 * @typeParam TValue - signal 值类型
 * @param value - 初始值
 * @param options - signals-core 原生 signal 配置
 * @returns 可写 reactive signal
 *
 * @example
 * ```ts
 * const count = createSignal(0)
 * count.value = 1
 * ```
 */
export function createSignal<TValue>(
  value: TValue,
  options?: SignalOptions<TValue>
): Signal<TValue>

/**
 * 创建初始值为 undefined 的 reactive signal。
 *
 * @typeParam TValue - signal 值类型
 * @param value - 可选初始值
 * @param options - signals-core 原生 signal 配置
 * @returns 可写 reactive signal
 *
 * @example
 * ```ts
 * const optionalCount = createSignal<number>()
 * optionalCount.value = 1
 * ```
 */
export function createSignal<TValue = undefined>(
  value?: TValue,
  options?: SignalOptions<TValue | undefined>
): Signal<TValue | undefined>

/**
 * `createSignal` overload 的运行时实现。
 *
 * @param value - 可选初始值。
 * @param options - signals-core 原生 signal 配置。
 * @returns 可写 reactive signal。
 */
export function createSignal<TValue>(
  value?: TValue,
  options?: SignalOptions<TValue | undefined>
): Signal<TValue | undefined> {
  return signal(value, options)
}

export type { ReadonlySignal, Signal, SignalOptions }
