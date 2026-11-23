/**
 * AsyncComputation - 异步派生状态容器。
 *
 * 支持竞态防护：新 run abort 旧 run，旧 result 不能覆盖新 result。
 *
 * @module core/scheduler/asyncComputation
 */

import { createSignal } from "../reactivity"

import type { Scope } from "../node"
import type { Signal } from "../reactivity"
import type { FieldValue, NamePath, Values } from "../types"
import type { Scheduler } from "./scheduler"

/**
 * 异步派生状态容器。
 *
 * @typeParam TValue - 计算结果类型
 */
export interface AsyncComputation<TValue> {
  /**
   * 当前值信号。
   */
  readonly value: Signal<TValue>

  /**
   * 是否正在加载。
   */
  readonly loading: Signal<boolean>

  /**
   * 错误信号。
   */
  readonly error: Signal<Error | null>

  /**
   * 关联的 scope。
   */
  readonly scope: Scope

  /**
   * 执行计算。
   *
   * @returns 计算完成后 resolve 的 Promise。
   */
  run(): Promise<void>

  /**
   * 释放资源。
   */
  dispose(): void
}

/**
 * 创建 AsyncComputation 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 字段 name path
 * @typeParam TValue - 计算结果类型（默认由 FieldValue 推导）
 */
export interface AsyncComputationOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
> {
  /**
   * 计算标识。
   */
  id: string

  /**
   * 关联的 scope。
   */
  scope: Scope

  /**
   * 调度器。
   */
  scheduler: Scheduler

  /**
   * 初始值。
   */
  initialValue: TValue

  /**
   * 计算函数。
   *
   * @param signal - AbortSignal
   * @returns 计算结果（同步或异步）
   */
  compute(signal: AbortSignal): Promise<TValue> | TValue
}

/**
 * 创建一个 AsyncComputation 实例。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 字段 name path
 * @typeParam TValue - 计算结果类型（默认由 FieldValue 推导）
 * @param options - 配置选项
 * @returns 新创建的 AsyncComputation
 *
 * @example
 * ```ts
 * const computation = createAsyncComputation({
 *   id: "field:props:visible",
 *   scope,
 *   scheduler,
 *   initialValue: true,
 *   compute: async (signal) => {
 *     const result = await fetchVisible(signal)
 *     return result
 *   },
 * })
 *
 * await computation.run()
 * console.log(computation.value.value)
 * ```
 */
export function createAsyncComputation<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
>(options: AsyncComputationOptions<TValues, TName, TValue>): AsyncComputation<TValue> {
  const value = createSignal<TValue>(options.initialValue)
  const loading = createSignal(false)
  const error = createSignal<Error | null>(null)

  // 创建内部子 scope，隔离自身资源与外部 scope
  const ownScope = options.scope.child()

  let version = 0
  let controller: AbortController | null = null

  /**
   * 执行当前计算。
   */
  const runCurrentComputation = async (
    currentVersion: number,
    currentController: AbortController
  ): Promise<void> => {
    try {
      const nextValue = await options.compute(currentController.signal)

      // 检查是否过期
      if (isStale(currentVersion, currentController)) {
        return
      }

      value.value = nextValue
    } catch (cause) {
      // 检查是否过期
      if (isStale(currentVersion, currentController)) {
        return
      }

      error.value = normalizeError(cause)
    } finally {
      // 检查是否过期
      if (!isStale(currentVersion, currentController)) {
        loading.value = false
      }
    }
  }

  /**
   * 检查是否过期。
   */
  const isStale = (
    currentVersion: number,
    currentController: AbortController
  ): boolean => {
    return (
      ownScope.disposed || currentController.signal.aborted || currentVersion !== version
    )
  }

  /**
   * 执行计算。
   */
  const run = async (): Promise<void> => {
    if (ownScope.disposed) {
      return
    }

    const currentVersion = ++version
    controller?.abort()
    controller = new AbortController()

    loading.value = true
    error.value = null

    await options.scheduler.track(runCurrentComputation(currentVersion, controller))
  }

  /**
   * 释放资源。
   */
  const dispose = (): void => {
    version += 1
    controller?.abort()
    ownScope.dispose()
  }

  // 注册 cleanup 到外部 scope，确保外部 scope 释放时触发清理
  options.scope.add(dispose)

  return {
    value,
    loading,
    error,
    scope: options.scope,
    run,
    dispose,
  }
}

/**
 * 标准化错误。
 *
 * @param cause - 错误原因
 * @returns Error 实例
 */
function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
