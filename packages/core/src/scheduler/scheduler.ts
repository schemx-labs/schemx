/**
 * Scheduler - 通用任务调度器。
 *
 * Scheduler 不存在 validation/dependency/renderer 业务 channel，
 * 只管理 sync/pre/normal/post 优先级任务。
 *
 * @module core/scheduler/scheduler
 */

import type { Scope } from "../node"

/**
 * 任务优先级。
 *
 * 执行顺序: sync → pre → normal → post
 */
type TaskPriority = "sync" | "pre" | "normal" | "post"

/**
 * 调度任务。
 */
export interface ScheduledTask {
  /**
   * 任务唯一标识。
   */
  id: string

  /**
   * 任务优先级。
   */
  priority: TaskPriority

  /**
   * 关联的 Scope，scope dispose 时任务被取消。
   */
  scope?: Scope

  /**
   * 执行任务。
   *
   * @returns 同步任务返回 void，异步任务返回 Promise
   */
  run(): void | Promise<void>

  /**
   * 错误回调。
   *
   * @param error - 执行错误
   */
  onError?(error: unknown): void
}

/**
 * 任务调度器。
 */
export interface Scheduler {
  /**
   * 调度任务。
   *
   * @param task - 调度任务
   */
  schedule(task: ScheduledTask): void

  /**
   * 执行所有待执行任务。
   *
   * @returns Promise 在所有任务完成后 resolve
   */
  flush(): Promise<void>

  /**
   * 等待所有任务完成（包括异步任务）。
   *
   * @param timeout - 超时时间（毫秒），默认 10000
   * @returns Promise<true> 所有任务完成，Promise<false> 超时
   */
  whenIdle(timeout?: number): Promise<boolean>

  /**
   * 跟踪异步任务。
   *
   * @typeParam T - 返回值类型
   * @param promise - 异步任务
   * @returns 原始 promise
   */
  track<T>(promise: Promise<T>): Promise<T>

  /**
   * 释放调度器。
   */
  dispose(): void
}

/**
 * 优先级执行顺序。
 */
const PRIORITY_ORDER: TaskPriority[] = ["sync", "pre", "normal", "post"]

/**
 * 创建一个 Scheduler 实例。
 *
 * @returns 新创建的 Scheduler
 *
 * @example
 * ```ts
 * const scheduler = createScheduler()
 *
 * // 调度任务
 * scheduler.schedule({
 *   id: "task-1",
 *   priority: "normal",
 *   run: () => console.log("task 1"),
 * })
 *
 * // 等待所有任务完成
 * await scheduler.whenIdle()
 *
 * // 跟踪异步任务
 * await scheduler.track(fetch("/api"))
 *
 * // 释放调度器
 * scheduler.dispose()
 * ```
 */
export function createScheduler(): Scheduler {
  // 四个优先级队列
  const queues = new Map<TaskPriority, Map<string, ScheduledTask>>(
    PRIORITY_ORDER.map((priority) => [priority, new Map()])
  )

  // Idle 等待者
  const idleResolvers = new Set<(idle: boolean) => void>()

  // 飞行中异步任务计数
  let pendingAsync = 0

  // 是否已释放
  let disposed = false

  // 当前 flush Promise
  let currentFlush: Promise<void> | null = null

  /**
   * 执行所有待执行任务。
   *
   * 如果已有正在执行的 flush 则复用其 Promise，防止并发执行。
   * flush 完成后自动检查空闲状态并通知等待者。
   */
  const flush = async (): Promise<void> => {
    if (disposed) {
      return
    }

    if (currentFlush) {
      return currentFlush
    }

    currentFlush = flushOnce().finally(() => {
      currentFlush = null
      notifyIdleIfNeeded()
    })

    return currentFlush
  }

  /**
   * 单次 flush 执行。
   *
   * 循环从队列中取出批次执行，直到所有队列为空或调度器被释放。
   * 对每个任务按序执行，遇到异步任务则通过 track() 等待其完成。
   */
  const flushOnce = async (): Promise<void> => {
    while (!disposed) {
      const batch = takeBatch()

      if (batch.length === 0) {
        return
      }

      for (const task of batch) {
        // 跳过已 disposed 的任务
        if (disposed || task.scope?.disposed) {
          continue
        }

        try {
          const result = task.run()

          // 跟踪异步任务
          if (isPromiseLike(result)) {
            await track(result)
          }
        } catch (error) {
          task.onError?.(error)
        }
      }
    }
  }

  /**
   * 调度任务。
   *
   * 按优先级将任务加入对应队列，通过 queueMicrotask 异步触发 flush。
   * 已释放的调度器或任务直接忽略。
   */
  const schedule = (task: ScheduledTask): void => {
    // 跳过已 disposed 的调度器或任务
    if (disposed || task.scope?.disposed) {
      return
    }

    queues.get(task.priority)?.set(task.id, task)
    queueMicrotask(() => void flush())
  }

  /**
   * 从所有队列取出一批任务。
   *
   * 按优先级顺序遍历队列，取出当前所有已调度的任务并清空队列。
   * 同一批次内按 sync → pre → normal → post 顺序执行。
   */
  const takeBatch = (): ScheduledTask[] => {
    const batch: ScheduledTask[] = []

    for (const priority of PRIORITY_ORDER) {
      const queue = queues.get(priority)

      if (!queue) {
        continue
      }

      batch.push(...queue.values())
      queue.clear()
    }

    return batch
  }

  /**
   * 跟踪异步任务。
   *
   * 增加飞行中任务计数，任务完成后减少计数并检查空闲状态。
   * 用于确保 whenIdle 能正确等待所有异步任务完成。
   */
  const track = async <T>(promise: Promise<T>): Promise<T> => {
    pendingAsync += 1

    try {
      return await promise
    } finally {
      pendingAsync -= 1
      notifyIdleIfNeeded()
    }
  }

  /**
   * 等待所有任务完成。
   *
   * 如果当前空闲则立即 resolve true；
   * 否则注册回调，等待所有队列清空且异步任务完成后 resolve。
   * 超时未完成则 resolve false。
   *
   * @param timeout - 超时时间（毫秒），默认 10000
   * @returns true 表示所有任务已完成，false 表示超时
   */
  const whenIdle = (timeout = 10000): Promise<boolean> => {
    if (isIdle()) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        idleResolvers.delete(resolve)
        resolve(false)
      }, timeout)

      idleResolvers.add((idle) => {
        globalThis.clearTimeout(timeoutId)
        resolve(idle)
      })
    })
  }

  /**
   * 检查调度器是否空闲。
   *
   * 空闲条件：无正在执行的 flush、无飞行中异步任务、队列为空。
   */
  const isIdle = (): boolean => {
    return !currentFlush && pendingAsync === 0 && !hasQueuedTasks()
  }

  /**
   * 检查是否有待执行任务。
   */
  const hasQueuedTasks = (): boolean => {
    return Array.from(queues.values()).some((queue) => queue.size > 0)
  }

  /**
   * 如果空闲则通知所有等待者。
   */
  const notifyIdleIfNeeded = (): void => {
    if (!isIdle()) {
      return
    }

    const resolvers = Array.from(idleResolvers)

    idleResolvers.clear()
    resolvers.forEach((resolve) => resolve(true))
  }

  /**
   * 释放调度器。
   *
   * 标记已释放，清空所有任务队列，并通知所有等待者。
   * 释放后 schedule() 和 flush() 将不再执行新任务。
   */
  const dispose = (): void => {
    disposed = true
    queues.forEach((queue) => queue.clear())
    notifyIdleIfNeeded()
  }

  return {
    schedule,
    flush,
    whenIdle,
    track,
    dispose,
  }
}

/**
 * 检查值是否为 PromiseLike（具有 then 方法的对象）。
 *
 * 用于区分同步任务与异步任务，以便 track() 正确计数。
 */
const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as PromiseLike<unknown>).then === "function"
  )
}
