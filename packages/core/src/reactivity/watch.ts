import { createDebouncedFn } from "../utils"

import { createSignalEffect, runSignalUntracked } from "./effect"

import type { SignalEffectDispose } from "./effect"
import type { DebouncedFnOptions } from "../utils"

/**
 * Signal watch 配置。
 */
export interface SignalWatchOptions<TValue> {
  /**
   * 是否在创建 watch 时立即执行一次 callback。
   *
   * @default false
   */
  immediate?: boolean

  /**
   * callback 第一次真正执行后是否自动停止监听。
   *
   * @default false
   */
  once?: boolean

  /**
   * 判断 source 新旧值是否相同。
   *
   * @default Object.is
   */
  equals?: (value: TValue, previousValue: TValue) => boolean
}

/**
 * Debounced signal watch 配置。
 */
export interface DebouncedSignalWatchOptions<TValue>
  extends SignalWatchOptions<TValue>, DebouncedFnOptions {}

/**
 * Debounced signal watch 控制器。
 */
export interface DebouncedSignalWatchControls {
  /**
   * 使用当前 source 值手动触发一次 debounce。
   */
  run: () => void

  /**
   * 取消当前等待中的 debounce callback。
   *
   * @remarks
   * 不会停止 signal 监听。
   */
  cancel: () => void

  /**
   * 立即执行当前等待中的 debounce callback。
   *
   * @remarks
   * 不会停止 signal 监听。
   */
  flush: () => void

  /**
   * 停止 signal 监听，并取消尚未执行的 debounce callback。
   */
  dispose: SignalEffectDispose
}

/**
 * 创建 signal watch。
 *
 * `source` 在 reactive effect 中同步执行，因此其中读取的 signal
 * 会被自动追踪。
 *
 * `callback` 则在 untracked 上下文中执行，因此 callback 内读取的
 * signal 不会成为该 watch 的依赖。
 *
 * @typeParam TValue - source 返回值类型。
 *
 * @param source - 响应式数据源。
 * @param callback - source 变化后的回调。
 * @param options - watch 配置。
 *
 * @returns 停止监听的函数。
 *
 * @example
 * ```ts
 * const stop = createSignalWatch(
 *   () => keyword.value,
 *   (value) => search(value)
 * )
 *
 * stop()
 * ```
 */
export function createSignalWatch<TValue>(
  source: () => TValue,
  callback: (value: TValue) => void,
  options: SignalWatchOptions<TValue> = {}
): SignalEffectDispose {
  const equals = options.equals ?? Object.is

  let initialized = false

  let stopped = false

  let previousValue: TValue

  // disposer 可能在 createSignalEffect 的同步回调中尚未完成赋值。
  // eslint-disable-next-line prefer-const
  let disposeEffect: SignalEffectDispose | undefined

  let stopRequested = false

  /**
   * 停止当前 watch。
   */
  function stop() {
    if (stopped) {
      return
    }

    stopped = true

    if (disposeEffect) {
      disposeEffect()

      return
    }

    // immediate callback 可能发生在 effect disposer 完成赋值之前。
    stopRequested = true
  }

  /**
   * 执行 watch callback。
   */
  function execute(value: TValue) {
    runSignalUntracked(() => {
      callback(value)
    })

    if (options.once) {
      stop()
    }
  }

  disposeEffect = createSignalEffect(() => {
    const value = source()

    if (!initialized) {
      initialized = true
      previousValue = value

      if (options.immediate) {
        execute(value)
      }

      return
    }

    if (equals(value, previousValue)) {
      return
    }

    previousValue = value

    execute(value)
  })

  if (stopRequested) {
    disposeEffect()
  }

  return stop
}

/**
 * 创建带 debounce 的 signal watch。
 *
 * `source` 中读取的 signal 会由 `createSignalWatch` 自动追踪。
 * 当 source 的结果发生变化时，新的值会进入 debounce 调度。
 *
 * @typeParam TValue - source 返回值类型。
 *
 * @param source - 响应式数据源。
 * @param callback - debounce 后执行的回调。
 * @param options - watch 与 debounce 配置。
 *
 * @returns debounce signal watch 控制器。
 *
 * @remarks
 * - `cancel()` 只取消当前等待中的 callback，不停止 signal 监听。
 * - `flush()` 立即执行当前等待中的 callback，不停止 signal 监听。
 * - `run()` 使用当前 source 值手动触发 debounce。
 * - `dispose()` 停止 signal 监听并取消 pending callback。
 * - `once` 表示 callback 第一次真正执行后自动 dispose。
 *
 * `immediate` 只表示初始 source 值会进入 debounce，
 * 并不意味着绕过 debounce 等待时间。
 * 真正的执行时机仍由 `edges` 决定。
 *
 * @example
 * ```ts
 * const watcher = createDebouncedSignalWatch(
 *   () => keyword.value,
 *   value => {
 *     search(value)
 *   },
 *   {
 *     wait: 300,
 *   }
 * )
 *
 * watcher.run()
 * watcher.cancel()
 * watcher.flush()
 * watcher.dispose()
 * ```
 */
export function createDebouncedSignalWatch<TValue>(
  source: () => TValue,
  callback: (value: TValue) => void,
  options: DebouncedSignalWatchOptions<TValue> = {}
): DebouncedSignalWatchControls {
  const {
    wait = 16,
    edges = ["trailing"],
    immediate = false,
    once = false,
    equals,
  } = options

  let disposed = false

  let disposeRequested = false

  // disposer 可能在 createSignalWatch 的同步回调中尚未完成赋值。
  // eslint-disable-next-line prefer-const
  let disposeWatch: SignalEffectDispose | undefined

  /**
   * 完全释放当前 debounced watch。
   */
  function dispose() {
    if (disposed) {
      return
    }

    disposed = true

    debounced.cancel()

    if (disposeWatch) {
      disposeWatch()

      return
    }

    // leading + immediate 时 callback 可能同步执行，
    // 此时 createSignalWatch 尚未返回 disposer。
    disposeRequested = true
  }

  /**
   * 执行最终 callback。
   */
  function execute(value: TValue) {
    if (disposed) {
      return
    }

    runSignalUntracked(() => {
      callback(value)
    })

    if (once) {
      dispose()
    }
  }

  const debounced = createDebouncedFn<[TValue]>(execute, {
    wait,
    edges,
  })

  disposeWatch = createSignalWatch(
    source,
    (value) => {
      if (disposed) {
        return
      }

      debounced.run(value)
    },
    {
      immediate,
      equals,
    }
  )

  if (disposeRequested) {
    disposeWatch()
  }

  /**
   * 使用 source 当前值手动触发 debounce。
   */
  function run() {
    if (disposed) {
      return
    }

    const value = runSignalUntracked(source)

    debounced.run(value)
  }

  /**
   * 取消 pending callback。
   */
  function cancel() {
    if (disposed) {
      return
    }

    debounced.cancel()
  }

  /**
   * 立即执行 pending callback。
   */
  function flush() {
    if (disposed) {
      return
    }

    debounced.flush()
  }

  return {
    run,
    cancel,
    flush,
    dispose,
  }
}
