import { createComputed, createSignalEffect, runSignalUntracked } from "./index"

import type { DeepReadonly } from "../types"

/**
 * Core 原生只读响应式值；订阅遵循 Signal 语义，立即交付当前值。
 *
 * @typeParam TValue - 当前状态值的类型。
 */
export interface ReadonlyState<TValue> {
  /**
   * 读取当前值，并在 Core effect 内建立依赖。
   */
  readonly value: DeepReadonly<TValue>
  /**
   * 无依赖读取当前值。
   */
  peek(): DeepReadonly<TValue>
  /**
   * 立即交付当前值，并订阅后续变化；返回幂等取消函数。
   * @param listener - 接收只读当前值的消费者。
   */
  subscribe(listener: (value: DeepReadonly<TValue>) => void): () => void
}

/**
 * Core 子系统持有的响应式生命周期，不包含框架 owner 或引用计数。
 */
export interface ReactiveScope {
  /**
   * 当前生命周期是否已结束。
   */
  readonly disposed: boolean
  /**
   * 创建由当前生命周期管理的 effect。
   * @param run - 建立依赖与执行业务逻辑的回调。
   */
  effect(this: void, run: () => void): () => void
  /**
   * 创建由底层 computed 缓存与追踪的只读状态。
   * @typeParam TValue - 派生值的类型。
   * @param read - 直接读取 Core 原生状态的派生函数。
   */
  state<TValue>(read: () => TValue): ReadonlyState<TValue>
  /**
   * 停止全部订阅并禁止新建状态；已取得的只读值仍遵循原生 computed 读取语义。
   */
  dispose(): void
}

/**
 * 创建 Core 原生响应式生命周期，复用 Signal 的缓存、依赖图和调度。
 *
 * @param isDisposed - 可选的响应式终态；变为 true 后交付最后一次状态并自动释放订阅。
 * @returns 管理当前子系统 effect 与只读状态的生命周期。
 * @example
 * const scope = createReactiveScope()
 * const doubled = scope.state(() => count.value * 2)
 * const stop = doubled.subscribe(console.log)
 * stop()
 * scope.dispose()
 */
export function createReactiveScope(isDisposed?: () => boolean): ReactiveScope {
  // 生命周期只管理取消函数；状态依赖和通知完全由底层 Signal 维护。
  let disposed = false

  const effects = new Set<() => void>()

  // 外部终态只提供生命周期信号；通知顺序与依赖切换仍交给原生 effect。
  const isClosed = (): boolean => disposed || (isDisposed?.() ?? false)

  /**
   * 注册 effect，并覆盖首次同步执行期间销毁生命周期的情况。
   * @param run - 当前 effect 的回调。
   */
  const effect = (run: () => void): (() => void) => {
    if (runSignalUntracked(isClosed)) {
      return () => {}
    }

    // 首次同步回调可能关闭生命周期，真实取消函数会在 effect 创建后接管。
    let stop = (): void => {}

    const cancel = createSignalEffect(() => {
      const finished = isDisposed?.() ?? false

      try {
        run()
      } finally {
        if (finished) stop()
      }
    })

    if (runSignalUntracked(isClosed)) {
      cancel()

      return () => {}
    }

    effects.add(cancel)

    stop = (): void => {
      if (effects.delete(cancel)) {
        cancel()
      }
    }

    return stop
  }

  /**
   * 为原生 computed 提供只读访问与所属生命周期的订阅。
   * @typeParam TValue - 派生值的类型。
   * @param read - Core 状态读取函数。
   */
  const state = <TValue>(read: () => TValue): ReadonlyState<TValue> => {
    if (runSignalUntracked(isClosed)) {
      throw new Error("[schemx] Reactive scope has been disposed.")
    }

    // 直接使用原生 computed 的惰性求值与缓存，不另存快照或管理监听器集合。
    const signal = createComputed(read)

    const getValue = (): DeepReadonly<TValue> => signal.value as DeepReadonly<TValue>

    const peek = (): DeepReadonly<TValue> => signal.peek() as DeepReadonly<TValue>

    /**
     * 将监听器纳入当前生命周期；消费者读取不会污染派生值依赖。
     * @param listener - 读取当前只读值的消费者。
     */
    const subscribe = (listener: (value: DeepReadonly<TValue>) => void): (() => void) =>
      effect(() => {
        const value = getValue()

        runSignalUntracked(() => listener(value))
      })

    // getter 直接读取 computed，不建立独立快照来源或订阅分发器。
    const readonlyState = Object.defineProperty({ peek, subscribe }, "value", {
      enumerable: true,
      get: getValue,
    }) as ReadonlyState<TValue>

    return readonlyState
  }

  /**
   * 停止当前子系统的全部 effect，重复销毁不执行额外操作。
   */
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    for (const cancel of Array.from(effects).reverse()) {
      cancel()
    }

    effects.clear()
  }

  // 仅生命周期状态使用 getter，其余能力都是稳定函数引用。
  const scope = Object.defineProperty({ effect, state, dispose }, "disposed", {
    get: () => runSignalUntracked(isClosed),
  }) as ReactiveScope

  return scope
}
