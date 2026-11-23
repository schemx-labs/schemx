/**
 * createEffect - 底层通用 reactive effect 工具
 *
 * 通过 core reactivity 层创建 effect，不依赖 form 实例。它提供最底层的
 * 响应式 effect 能力：在 effect 回调中访问 reactive value 时自动追踪
 * 依赖，依赖变化时自动重新执行回调。
 *
 * 相比 `createWatch` 系列函数（需要传入 form 实例，提供结构化的 payload 和 diff 计算），
 * `createEffect` 更底层、更灵活，不做任何值比较或 payload 封装。
 *
 * 支持 cleanup 机制：effect 回调可返回一个清理函数，
 * 该函数会在 effect 重新执行前或被 dispose 时自动调用。
 *
 * @module core/createEffect
 *
 * @example
 * ```ts
 * import { createEffect } from '@schemx/core'
 * const dispose = createEffect(() => {
 *   console.log('reactive dependencies read here will be tracked')
 *   return () => {
 *     console.log('cleanup')
 *   }
 * })
 * dispose()
 * ```
 */

import { createSignalEffect } from "./reactivity"

/**
 * effect 回调返回的清理函数。
 *
 * 清理函数会在 effect 重新执行前以及 dispose 时调用。
 */
export type CleanupFn = () => void

/**
 * reactive effect 回调。
 *
 * 回调执行期间读取的 reactive value 会被自动追踪。
 */
export type EffectCallback = () => CleanupFn | void

/**
 * `createEffect` 返回的释放函数。
 *
 * 多次调用是安全的，只有第一次会真正释放 effect 和最后一次 cleanup。
 */
export type CreateEffectReturn = () => void

/**
 * 创建通用 reactive effect。
 *
 * 在 effect 回调中访问任何 reactive value 时自动追踪依赖，
 * 依赖变化时自动重新执行回调。
 * 回调可返回一个清理函数，在 effect 重新执行前或被 dispose 时调用。
 *
 * @param callback - effect 回调函数，可选返回清理函数
 *
 * @returns 取消 effect 的 dispose 函数（幂等）
 *
 * @example
 * ```ts
 * import { createEffect } from '@schemx/core'
 * const dispose = createEffect(() => {
 *   console.log('reactive dependencies read here will be tracked')
 *   return () => console.log('cleanup')
 * })
 *
 * dispose()        // 取消 effect，调用最后一次 cleanup
 * ```
 */
export function createEffect(callback: EffectCallback): CreateEffectReturn {
  let cleanup: CleanupFn | undefined
  let disposed = false

  /**
   * 执行 effect 回调，并在重新执行前释放上一轮 cleanup。
   */
  const dispose = createSignalEffect(() => {
    cleanup?.()
    cleanup = undefined

    const result = callback()
    if (typeof result === "function") {
      cleanup = result
    }
  })

  /**
   * 释放 effect 与最后一次 cleanup；多次调用只执行一次。
   */
  const api = (): void => {
    if (disposed) return
    disposed = true
    dispose()
    cleanup?.()
    cleanup = undefined
  }

  return api
}
