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
   */
  const flushOnce = async (): Promise<void> => {
    const batch = takeBatch()

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

  /**
   * 调度任务。
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
   * 检查是否空闲。
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
 * 检查是否为 PromiseLike。
 */
const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as PromiseLike<unknown>).then === "function"
  )
}
