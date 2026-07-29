/**
 * 框架无关的 reactive effect 门面。
 *
 * createForm 和 SignalMap 都通过这里创建 effect，不直接 import
 * @preact/signals-core。
 *
 * @module core/reactivity/effect
 */

import { effect, untracked } from "@preact/signals-core"
import { debounce } from "es-toolkit"

import type { DebounceOptions } from "es-toolkit"

/**
 * reactive effect 的释放函数。
 */
export type SignalEffectDispose = () => void

/**
 * reactive effect 的配置。
 */
export interface SignalEffectOptions {
  /**
   * 是否只调用一次。
   *
   * 为 `true` 时，首次执行后会自动释放该 effect，后续 signal 变化将不再触发。
   *
   * @default false
   */
  once?: boolean
}

/**
 * 创建 reactive effect，但不暴露具体 reactivity 后端。
 *
 * @param fn - effect 回调，执行期间读取的 signal 会被追踪。
 * @param options - reactive effect 的配置。
 *
 * @returns 释放该 effect 的函数。
 */
export function createSignalEffect(
  fn: () => void,
  options: SignalEffectOptions = {}
): SignalEffectDispose {
  if (!options.once) {
    return effect(fn)
  }

  const disposeRef: { current?: SignalEffectDispose } = {}

  disposeRef.current = effect(() => {
    fn()
    disposeRef.current?.()
  })

  return () => disposeRef.current?.()
}

/**
 * 在不收集 signal 依赖的上下文中执行回调。
 *
 * 用于 effect 内需要读取当前快照、但该读取不应成为 effect 重跑条件的场景。
 *
 * @typeParam TResult - 回调返回值类型。
 * @param fn - 不应参与当前依赖收集的回调。
 * @returns 回调的返回值。
 */
export function runUntracked<TResult>(fn: () => TResult): TResult {
  return untracked(fn)
}

/**
 * debounce reactive effect 的配置。
 */
export interface DebouncedSignalEffectOptions {
  /**
   * 是否立即执行首次副作用。
   *
   * 后续 signal 变化仍会在 debounce 等待窗口结束后执行。
   *
   * @default false
   */
  immediate?: boolean

  /**
   * 后续变更触发 debounce 副作用的时机。
   *
   * @default ["trailing"]
   */
  edges?: DebounceOptions["edges"]

  /**
   * 是否只调用一次副作用。
   *
   * 为 `true` 时，`run` 首次执行（无论立即还是 debounce 后）后会自动释放
   * effect 并取消后续待执行回调，signal 变化将不再触发。默认为 `false`。
   *
   * @default false
   */
  once?: boolean
}

/**
 * 创建带 debounce 的 reactive effect。
 *
 * `collect` 会在 effect 中同步执行，以便追踪其中读取的 signal；
 * `run` 则在等待窗口结束后接收最新一次收集结果并执行。
 *
 * @typeParam TValue - `collect` 返回且传递给 `run` 的数据类型。
 *
 * @param collect - 同步读取 signal 并返回副作用所需数据的函数。
 * @param run - debounce 后执行的副作用函数。
 * @param wait - debounce 等待时间，单位为毫秒。默认为 16ms。
 * @param options - debounce reactive effect 的配置。
 *
 * @returns 释放 effect 并取消待执行 debounce 回调的函数。
 *
 * @remarks
 * 不要将 `collect` 内的 signal 读取移动到 `run` 中。异步执行时已经离开
 * effect 的依赖收集上下文，后续 signal 变化将无法重新触发该 effect。
 */
export function createDebouncedSignalEffect<TValue>(
  collect: () => TValue,
  run: (value: TValue) => void,
  wait = 16,
  options: DebouncedSignalEffectOptions = {}
): SignalEffectDispose {
  let initialized = false

  // 用包装后的 run 创建 debounce，使得无论是立即执行还是 debounce 回调，
  // 在 `once` 模式下首次执行后都能通过 teardown 释放 effect 并取消后续
  // 待执行回调。
  const wrappedRun = (value: TValue) => {
    run(value)

    if (options.once) {
      teardown()
    }
  }

  const debouncedRun = debounce(wrappedRun, wait, { edges: options.edges })

  const disposeEffect = createSignalEffect(() => {
    const value = collect()

    if (!initialized && options.immediate) {
      initialized = true
      wrappedRun(value)

      return
    }

    initialized = true
    debouncedRun(value)
  })

  const teardown = () => {
    disposeEffect()
    debouncedRun.cancel()
  }

  return teardown
}

/**
 * 创建只调用一次的 reactive effect。
 *
 * 等价于 `createSignalEffect(fn, { once: true })`：首次执行后会自动释放该
 * effect，后续 signal 变化将不再触发。
 *
 * @param fn - effect 回调，执行期间读取的 signal 会被追踪。
 *
 * @returns 释放该 effect 的函数。
 */
export function createOnceSignalEffect(fn: () => void): SignalEffectDispose {
  return createSignalEffect(fn, { once: true })
}
