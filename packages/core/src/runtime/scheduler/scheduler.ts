/**
 * Scheduler - 通用任务调度器。
 *
 * Scheduler 不存在 validation/dependency/renderer 业务 channel，
 * 只管理 normal/post 两级 keyed 任务。
 *
 * @module core/runtime/scheduler/scheduler
 */

import type { Scope } from "../node"

/**
 * 任务优先级。
 *
 * 执行顺序: normal → post
 */
type TaskPriority = "normal" | "post"

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
   * @typeParam TResult - 返回值类型
   * @param promise - 异步任务
   * @returns 原始 promise
   */
  track<TResult>(promise: Promise<TResult>): Promise<TResult>

  /**
   * 跟踪可提前从 idle 判断中移除的逻辑任务。
   *
   * cancel 不会中止原始 Promise；调用方仍需自行中止底层操作。
   */
  trackCancellable<TResult>(promise: Promise<TResult>): CancellableTask<TResult>

  /**
   * 释放调度器。
   */
  dispose(): void
}

/** Scheduler 跟踪的可取消逻辑任务。 */
export interface CancellableTask<TResult> {
  /** 原始任务 Promise。 */
  readonly promise: Promise<TResult>
  /** 任务失效后将其从 idle 判断中移除。 */
  cancel(): void
}

/** 保存等待调度器进入 idle 状态的调用方及其超时句柄。 */
interface IdleWaiter {
  /** 等待结果的 resolve 回调。 */
  readonly resolve: (idle: boolean) => void
  /** 等待超时句柄。 */
  timeoutId?: ReturnType<typeof globalThis.setTimeout>
}

/**
 * 队列执行顺序。
 */
const PRIORITY_ORDER: readonly TaskPriority[] = ["normal", "post"]

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
  // normal/post 两个 keyed 队列
  const queues = new Map<TaskPriority, Map<string, ScheduledTask>>(
    PRIORITY_ORDER.map((priority) => [priority, new Map()])
  )

  // Idle 等待者
  const idleWaiters = new Set<IdleWaiter>()

  // 参与 idle 判断的逻辑异步任务。
  const pendingTasks = new Set<object>()

  // 是否已释放
  let disposed = false

  // 当前 flush Promise
  let currentFlush: Promise<void> | null = null

  // 是否已安排当前 tick 的 flush microtask
  let flushScheduled = false

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
          if (task.onError) {
            task.onError(error)
          } else {
            console.error(`[schemx] 调度任务 "${task.id}" 执行错误`, error)
          }
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

    if (flushScheduled) {
      return
    }

    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      void flush()
    })
  }

  /**
   * 从所有队列取出一批任务。
   *
   * 按优先级顺序遍历队列，取出当前所有已调度的任务并清空队列。
   * 同一批次内按 normal → post 顺序执行。
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
  const track = async <TResult>(promise: Promise<TResult>): Promise<TResult> => {
    return await trackCancellable(promise).promise
  }

  /**
   * 将异步工作作为可取消的逻辑任务纳入 idle 判断。
   */
  const trackCancellable = <TResult>(promise: Promise<TResult>): CancellableTask<TResult> => {
    const task = {}

    let settled = false

    const settle = (): void => {
      if (settled) {
        return
      }

      settled = true
      pendingTasks.delete(task)
      notifyIdleIfNeeded()
    }

    pendingTasks.add(task)
    void promise.then(settle, settle)

    return {
      promise,
      cancel: settle,
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
      const waiter: IdleWaiter = { resolve }

      waiter.timeoutId = globalThis.setTimeout(() => {
        settleIdleWaiter(waiter, false)
      }, timeout)

      idleWaiters.add(waiter)
    })
  }

  /**
   * 检查调度器是否空闲。
   *
   * 空闲条件：无正在执行的 flush、无飞行中异步任务、队列为空。
   */
  const isIdle = (): boolean => {
    return !currentFlush && pendingTasks.size === 0 && !hasQueuedTasks()
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

    const waiters = Array.from(idleWaiters)

    waiters.forEach((waiter) => settleIdleWaiter(waiter, true))
  }

  /**
   * 结束一个 idle waiter，并清理其 timeout。
   */
  const settleIdleWaiter = (waiter: IdleWaiter, idle: boolean): void => {
    if (!idleWaiters.delete(waiter)) {
      return
    }

    if (waiter.timeoutId !== undefined) {
      globalThis.clearTimeout(waiter.timeoutId)
    }

    waiter.resolve(idle)
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
    pendingTasks.clear()

    const waiters = Array.from(idleWaiters)

    waiters.forEach((waiter) => settleIdleWaiter(waiter, false))
  }

  return {
    schedule,
    flush,
    whenIdle,
    track,
    trackCancellable,
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
