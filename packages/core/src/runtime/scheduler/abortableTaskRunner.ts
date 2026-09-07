/**
 * AbortableTaskRunner - 可中止的异步任务运行器。
 *
 * 封装 AbortController 与版本号机制，确保多次调用 run() 时只有最新一次
 * 的任务结果会触发 onSuccess/onError 回调，之前的请求自动被中止。
 * 配合 Scheduler.track() 实现异步任务的统一生命周期管理。
 *
 * @module core/runtime/scheduler/abortableTaskRunner
 */

import type { Scope } from "../node"
import type { CancellableTask, Scheduler, SchedulerTaskPriority } from "./scheduler"

/**
 * 可中止异步任务运行器的接口。
 *
 * @typeParam TValue - 任务返回值类型
 */
export interface AbortableTaskRunner<TValue = void> {
  /**
   * 执行一次异步任务。
   *
   * 如果上次任务尚未完成，会自动中止上次任务再启动新任务。
   * 只有最近一次 run() 的结果才会触发回调。
   *
   * @returns 任务结果；scope 已销毁或任务以错误结束且未启用 `throwOnError` 时返回 `undefined`。
   */
  run(): Promise<TValue | undefined>

  /**
   * 释放运行器，中止当前任务并清理所有资源。
   */
  dispose(): void
}

/**
 * AbortableTaskRunner 的配置选项。
 *
 * @typeParam TValue - 任务返回值类型
 */
export interface AbortableTaskRunnerOptions<TValue = void> {
  /**
   * 生命周期 scope，用于在 scope 销毁时自动中止任务。
   */
  scope: Scope

  /**
   * 异步任务调度器，用于跟踪任务执行。
   */
  scheduler: Scheduler

  /**
   * 任务所属优先级，用于决定是否阻塞关键空闲判断。
   *
   * @defaultValue "normal"
   */
  priority?: SchedulerTaskPriority

  /**
   * 实际要执行的异步任务。
   *
   * 接收 AbortSignal 以便在任务内部感知中止信号。
   *
   * @param signal - 中止信号，任务内部可监听 signal.aborted 及时退出
   * @returns 任务结果
   */
  run(signal: AbortSignal): Promise<TValue> | TValue

  /**
   * 任务启动时的回调。
   *
   * @param controller - 本次任务的 AbortController
   */
  onStart?(controller: AbortController): void

  /**
   * 任务成功完成时的回调。
   *
   * 仅最新一次 run() 成功时触发；被中止或过期任务不会触发。
   *
   * @param value - 任务返回值
   */
  onSuccess?(value: TValue): void

  /**
   * 任务出错时的回调。
   *
   * 仅最新一次 run() 出错时触发；被中止或过期任务不会触发。
   *
   * @param error - 错误对象
   */
  onError?(error: Error): void

  /**
   * 任务结束（成功或失败）时的回调。
   *
   * 仅在最新一次 run() 结束时触发；被中止或过期任务不会触发。
   */
  onSettled?(): void

  /**
   * 是否向外抛出任务执行中的错误。
   *
   * - true: 错误会从 run() 的 Promise 中抛出
   * - false（默认）: 错误只触发 onError 回调，run() 返回 undefined
   */
  throwOnError?: boolean
}

/**
 * 创建一个可中止的异步任务运行器。
 *
 * 每次调用 run() 时递增版本号并中止上一个 AbortController，
 * 确保只有最新一次任务的结果被消费。任务通过 scheduler.track()
 * 注册到调度器中，便于统一等待。
 *
 * @typeParam TValue - 任务返回值类型
 * @param options - 配置选项
 * @returns AbortableTaskRunner 实例
 *
 * @example
 * ```ts
 * const runner = createAbortableTaskRunner({
 *   scope,
 *   scheduler,
 *   run: async (signal) => {
 *     const response = await fetch('/api/data', { signal })
 *     return response.json()
 *   },
 *   onSuccess: (data) => console.log('data:', data),
 *   onError: (error) => console.error('failed:', error),
 * })
 *
 * await runner.run()  // 发起请求
 * await runner.run()  // 中止上一个请求，发起新请求
 * runner.dispose()     // 清理资源
 * ```
 */
export function createAbortableTaskRunner<TValue = void>(
  options: AbortableTaskRunnerOptions<TValue>
): AbortableTaskRunner<TValue> {
  // 从外部 scope 衍生独立子 scope，dispose 时自动中止所有未完成任务
  const ownScope = options.scope.child()

  // 单调递增版本号，每次 run() 递增，用于判断任务是否已过期
  let version = 0

  // 当前正在执行的任务的 AbortController
  let controller: AbortController | null = null

  // 当前参与 idle 判断的逻辑任务。
  let activeTask: CancellableTask<TValue | undefined> | null = null

  /**
   * 判断当前版本的任务是否已过期（应被忽略）。
   *
   * 以下情况视为过期：
   * - 所属 scope 已被销毁
   * - 当前 AbortController 已被中止
   * - 版本号与最新不匹配（说明有更新的 run() 调用）
   *
   * @param currentVersion - 本次任务启动时记录的版本号。
   * @param currentController - 本次任务使用的 AbortController。
   * @returns 任务应被视为过期时返回 `true`。
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
   * 执行本次任务并根据是否过期决定是否触发回调。
   *
   * 任务完成后先判断是否过期：如果已过期则不触发 onSuccess/onError/onSettled；
   * 成功的过期任务仍返回其原始值，失败的过期任务按 `throwOnError` 决定是否抛出。
   *
   * @param currentVersion - 本次任务启动时记录的版本号。
   * @param currentController - 本次任务使用的 AbortController。
   * @returns 任务结果；未返回结果时为 `undefined`。
   */
  const runCurrentTask = async (
    currentVersion: number,
    currentController: AbortController
  ): Promise<TValue | undefined> => {
    try {
      const value = await options.run(currentController.signal)

      // 任务完成但已过期，不触发回调
      if (isStale(currentVersion, currentController)) {
        return value
      }

      options.onSuccess?.(value)
      options.onSettled?.()

      return value
    } catch (cause) {
      const error = normalizeError(cause)

      // 任务出错但已过期，不触发回调
      if (isStale(currentVersion, currentController)) {
        if (options.throwOnError) {
          throw error
        }

        return
      }

      if (options.onError) {
        options.onError(error)
      } else {
        console.error("[schemx] 可中止任务执行错误", error)
      }

      options.onSettled?.()

      if (options.throwOnError) {
        throw error
      }
    }
  }

  /**
   * 执行一次新的异步任务。
   *
   * 中止上一次未完成的任务，创建新的 AbortController，
   * 通过 scheduler.track() 注册以便调度器统一管理。
   */
  const run = async (): Promise<TValue | undefined> => {
    if (ownScope.disposed) {
      return
    }

    const currentVersion = ++version

    activeTask?.cancel()
    controller?.abort()
    controller = new AbortController()
    options.onStart?.(controller)

    const task = options.scheduler.trackCancellable(
      runCurrentTask(currentVersion, controller),
      { priority: options.priority }
    )

    activeTask = task

    try {
      return await task.promise
    } finally {
      if (activeTask === task) {
        activeTask = null
      }
    }
  }

  /**
   * 释放运行器。
   *
   * 递增版本号使所有正在执行的任务过期，中止当前任务，
   * 销毁子 scope 并清理所有注册的清理函数。
   */
  const dispose = (): void => {
    version += 1
    activeTask?.cancel()
    activeTask = null
    controller?.abort()
    ownScope.dispose()
  }

  // 将 dispose 注册到外部 scope，外部 scope 销毁时自动清理
  options.scope.add(dispose)

  return {
    run,
    dispose,
  }
}

/**
 * 将未知类型的错误规范化为 Error 实例。
 *
 * @param cause - 原始错误
 * @returns 标准化后的 Error 实例
 */
function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
