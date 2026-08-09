import { effect, untracked } from "@preact/signals-core"

/**
 * Signal effect 释放函数。
 */
export type SignalEffectDispose = () => void

/**
 * Signal effect 配置。
 */
export interface SignalEffectOptions {
  /**
   * 是否只执行一次。
   *
   * @remarks
   * `@preact/signals-core` 的 effect 创建时会立即执行，
   * 因此 once 表示执行首次 effect 后立即释放。
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
  const dispose = effect(fn)

  if (options.once) {
    dispose()
  }

  return dispose
}

/**
 * 在不追踪 signal 依赖的上下文中执行函数。
 *
 * @typeParam TValue - 函数返回值类型。
 *
 * @param fn - 需要执行的函数。
 *
 * @returns 函数执行结果。
 *
 * @remarks
 * 在 callback 等非依赖源逻辑中读取 signal 时，应使用该方法避免
 * 将额外的 signal 意外注册为当前 effect 的依赖。
 */
export function runSignalUntracked<TValue>(fn: () => TValue): TValue {
  return untracked(fn)
}
