/**
 * 框架无关的 reactive effect 门面。
 *
 * createForm 和 ReactiveMap 都通过这里创建 effect，不直接 import
 * @preact/signals-core。
 *
 * @module core/reactivity/effect
 */

import { effect } from "@preact/signals-core"
import { debounce } from "es-toolkit"

import type { DebounceOptions } from "es-toolkit"

/**
 * reactive effect 的释放函数。
 */
export type SignalEffectDispose = () => void

/**
 * 创建 reactive effect，但不暴露具体 reactivity 后端。
 *
 * @param fn - effect 回调，执行期间读取的 signal 会被追踪。
 *
 * @returns 释放该 effect 的函数。
 */
export function createSignalEffect(fn: () => void): SignalEffectDispose {
  return effect(fn)
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
}

/**
 * 创建带 debounce 的 reactive effect。
 *
 * `collect` 会在 effect 中同步执行，以便追踪其中读取的 signal；
 * `run` 则在等待窗口结束后接收最新一次收集结果并执行。
 *
 * @typeParam T - `collect` 返回且传递给 `run` 的数据类型。
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
export function createDebouncedSignalEffect<T>(
  collect: () => T,
  run: (value: T) => void,
  wait = 16,
  options: DebouncedSignalEffectOptions = {}
): SignalEffectDispose {
  const debouncedRun = debounce(run, wait, { edges: options.edges })
  let initialized = false

  const disposeEffect = createSignalEffect(() => {
    const value = collect()

    if (!initialized && options.immediate) {
      initialized = true
      run(value)

      return
    }

    initialized = true
    debouncedRun(value)
  })

  return () => {
    disposeEffect()
    debouncedRun.cancel()
  }
}
