/**
 * Scheduler - 通用任务调度器。
 *
 * Scheduler 不存在 validation/dependency/renderer 业务 channel，
 * 只管理带优先级的 keyed 任务。
 *
 * @module core/runtime/scheduler/scheduler
 */

import type { Scope } from "../node"

/**
 * 任务优先级。
 *
 * 执行顺序: normal → post → idle
 */
export type SchedulerTaskPriority = "normal" | "post" | "idle"

/**
 * Scheduler 创建配置。
 */
export interface SchedulerOptions {
  /**
   * 单次连续执行同步任务的最长时间（毫秒）。达到预算后会让出主线程。
   *
   * @defaultValue 5
   */
  readonly timeSliceMs?: number

  /**
   * idle 任务在没有空闲时间时的最长等待时间（毫秒）。
   *
   * @defaultValue 1000
   */
  readonly idleTimeout?: number

  /** 是否收集调度诊断数据；默认关闭。 */
  readonly collectDiagnostics?: boolean
}

/** Scheduler 调度诊断快照。 */
export interface SchedulerDiagnostics {
  readonly queued: Readonly<Record<SchedulerTaskPriority, number>>
  readonly yieldedCount: number
  readonly maxTaskDurationMs: number
}

/**
 * Scheduler 空闲等待配置。
 */
export interface SchedulerIdleOptions {
  /**
   * 最大等待时间（毫秒）。
   *
   * @defaultValue 10000
   */
  readonly timeout?: number

  /**
   * 是否等待 idle 队列和 idle 异步任务。
   *
   * @defaultValue true
   */
  readonly includeIdle?: boolean
}

/** 异步任务是否参与关键空闲判断的配置。 */
export interface SchedulerTrackOptions {
  /**
   * 任务所属优先级；idle 任务不会阻塞关键空闲判断。
   *
   * @defaultValue "normal"
   */
  readonly priority?: SchedulerTaskPriority
}

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
  priority: SchedulerTaskPriority

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
   * 包含 normal、post 和 idle 队列。
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
  whenIdle(options?: SchedulerIdleOptions): Promise<boolean>

  /**
   * 等待所有任务完成；保留数字参数以兼容旧调用方。
   *
   * @param timeout - 最大等待时间（毫秒）
   */
  whenIdle(timeout?: number): Promise<boolean>

  /**
   * 跟踪异步任务。
   *
   * @typeParam TResult - 返回值类型
   * @param promise - 异步任务
   * @returns 原始 promise
   */
  track<TResult>(
    promise: Promise<TResult>,
    options?: SchedulerTrackOptions
  ): Promise<TResult>

  /**
   * 跟踪可提前从 idle 判断中移除的逻辑任务。
   *
   * cancel 不会中止原始 Promise；调用方仍需自行中止底层操作。
   */
  trackCancellable<TResult>(
    promise: Promise<TResult>,
    options?: SchedulerTrackOptions
  ): CancellableTask<TResult>

  /**
   * 释放调度器。
   */
  dispose(): void

  /** 读取当前调度诊断快照。 */
  getDiagnostics(): SchedulerDiagnostics
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
  /** 是否将 idle 任务纳入空闲判断。 */
  readonly includeIdle: boolean
  /** 等待超时句柄。 */
  timeoutId?: ReturnType<typeof globalThis.setTimeout>
}

/**
 * 队列执行顺序。
 */
const PRIORITY_ORDER: readonly SchedulerTaskPriority[] = ["normal", "post", "idle"]

const DEFAULT_TIME_SLICE_MS = 5

const DEFAULT_IDLE_TIMEOUT = 1000

/** 浏览器空闲回调的最小结构，避免 Scheduler 依赖 DOM 类型。 */
interface IdleDeadlineLike {
  readonly didTimeout: boolean
  timeRemaining(): number
}

/** 支持 requestIdleCallback 的运行时全局对象。 */
interface IdleCallbackHost {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options: { timeout: number }
  ) => unknown
}

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
export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const timeSliceMs = options.timeSliceMs ?? DEFAULT_TIME_SLICE_MS

  const idleTimeout = options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT

  const collectDiagnostics = options.collectDiagnostics ?? false

  // normal/post/idle 三个 keyed 队列
  const queues = new Map<SchedulerTaskPriority, Map<string, ScheduledTask>>(
    PRIORITY_ORDER.map((priority) => [priority, new Map()])
  )

  // Idle 等待者
  const idleWaiters = new Set<IdleWaiter>()

  // 参与 idle 判断的逻辑异步任务。
  const pendingTasks = new Map<object, boolean>()

  // 当前正在执行的 normal/post 任务数量；用于关键空闲判断。
  let activeCriticalTasks = 0

  // 是否已释放
  let disposed = false

  // 当前 flush Promise
  let currentFlush: Promise<void> | null = null

  // 是否已安排当前 tick 的 flush microtask
  let flushScheduled = false

  // 是否已安排 idle 队列的浏览器空闲回调。
  let idleFlushScheduled = false

  // 正在执行的 flush 是否应一并处理 idle 队列。
  let shouldFlushIdleTasks = false

  let yieldedCount = 0

  let maxTaskDurationMs = 0

  /**
   * 执行全部待执行任务。
   *
   * 显式 flush 是调用方要求的同步边界，因此会包含 idle 队列；自动调度仅在
   * 浏览器空闲时处理 idle 任务。
   */
  const flush = async (): Promise<void> => {
    shouldFlushIdleTasks = true

    return await startFlush()
  }

  /**
   * 在浏览器空闲回调中处理 idle 队列。
   */
  const flushIdle = async (deadline: IdleDeadlineLike | undefined): Promise<void> => {
    if (disposed || !hasQueuedIdleTasks()) {
      return
    }

    if (deadline && !deadline.didTimeout && deadline.timeRemaining() <= 0) {
      scheduleIdleFlush()

      return
    }

    shouldFlushIdleTasks = true
    await startFlush(deadline)
  }

  /**
   * 启动或复用当前 flush。
   *
   * 如果已有正在执行的 flush 则复用其 Promise，防止并发执行；显式 flush
   * 可通过 shouldFlushIdleTasks 让已有任务循环继续处理 idle 队列。
   * flush 完成后自动检查空闲状态并通知等待者。
   */
  const startFlush = async (idleDeadline?: IdleDeadlineLike): Promise<void> => {
    if (disposed) {
      return
    }

    if (currentFlush) {
      return currentFlush
    }

    currentFlush = flushOnce(idleDeadline).finally(() => {
      currentFlush = null
      shouldFlushIdleTasks = false
      notifyIdleIfNeeded()
      scheduleQueuedFlushes()
    })

    return currentFlush
  }

  /**
   * 单次 flush 执行。
   *
   * 循环按优先级从队列中取任务，直到当前可执行队列为空或调度器被释放。
   * 每个时间片最多连续执行 timeSliceMs 毫秒的同步工作，随后让出主线程；
   * 这只能在任务边界切片，单个长同步任务仍需调用方自行拆分。
   */
  const flushOnce = async (idleDeadline?: IdleDeadlineLike): Promise<void> => {
    let sliceStartedAt = getCurrentTime()

    while (!disposed) {
      if (shouldPauseForIdleDeadline(idleDeadline)) {
        return
      }

      const task = takeNextTask()

      if (!task) {
        return
      }

      // 跳过已 disposed 的任务
      if (task.scope?.disposed) {
        continue
      }

      const isCriticalTask = task.priority !== "idle"

      if (isCriticalTask) {
        activeCriticalTasks += 1
      }

      try {
        const taskStartedAt = getCurrentTime()

        const result = task.run()

        const taskDurationMs = getCurrentTime() - taskStartedAt

        if (collectDiagnostics) {
          maxTaskDurationMs = Math.max(maxTaskDurationMs, taskDurationMs)
        }

        // 跟踪异步任务
        if (isPromiseLike(result)) {
          await track(result, { priority: task.priority })
        }
      } catch (error) {
        if (task.onError) {
          task.onError(error)
        } else {
          console.error(`[schemx] 调度任务 "${task.id}" 执行错误`, error)
        }
      } finally {
        if (isCriticalTask) {
          activeCriticalTasks -= 1
          notifyIdleIfNeeded()
        }
      }

      if (!shouldYield(sliceStartedAt, idleDeadline) || !hasTasksForCurrentFlush()) {
        continue
      }

      if (shouldPauseForIdleDeadline(idleDeadline)) {
        return
      }

      await yieldToHost()
      if (collectDiagnostics) {
        yieldedCount += 1
      }

      sliceStartedAt = getCurrentTime()
    }
  }

  /**
   * 调度任务。
   *
   * 按优先级将任务加入对应队列。normal/post 通过 microtask 执行；idle 任务
   * 则等待浏览器空闲回调，并由超时兜底避免长期饥饿。
   * 已释放的调度器或任务直接忽略。
   */
  const schedule = (task: ScheduledTask): void => {
    // 跳过已 disposed 的调度器或任务
    if (disposed || task.scope?.disposed) {
      return
    }

    queues.get(task.priority)?.set(task.id, task)

    scheduleQueuedFlushes()
  }

  /**
   * 按待执行任务的优先级安排下一次 flush。
   */
  const scheduleQueuedFlushes = (): void => {
    if (disposed) {
      return
    }

    if (hasQueuedNonIdleTasks()) {
      scheduleFlush()
    }

    if (hasQueuedIdleTasks()) {
      scheduleIdleFlush()
    }
  }

  /**
   * 通过 microtask 执行 normal/post 队列。
   */
  const scheduleFlush = (): void => {
    if (flushScheduled) {
      return
    }

    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      void startFlush()
    })
  }

  /**
   * 通过 requestIdleCallback 在浏览器空闲时执行 idle 队列。
   * 不支持该 API 的运行时退化为下一个 macrotask。
   */
  const scheduleIdleFlush = (): void => {
    if (idleFlushScheduled) {
      return
    }

    idleFlushScheduled = true

    const run = (deadline?: IdleDeadlineLike): void => {
      idleFlushScheduled = false
      void flushIdle(deadline)
    }

    const idleHost = globalThis as typeof globalThis & IdleCallbackHost

    if (idleHost.requestIdleCallback) {
      idleHost.requestIdleCallback(run, { timeout: idleTimeout })

      return
    }

    globalThis.setTimeout(run, 0)
  }

  /**
   * 按优先级从待执行队列取出一个任务。
   *
   * normal 和 post 始终优先于 idle。自动 flush 不处理 idle 队列，只有显式
   * flush 或空闲回调才会将其纳入执行范围。
   */
  const takeNextTask = (): ScheduledTask | undefined => {
    for (const priority of PRIORITY_ORDER) {
      if (priority === "idle" && !shouldFlushIdleTasks) {
        continue
      }

      const queue = queues.get(priority)

      const task = queue?.values().next().value

      if (!task) {
        continue
      }

      queue.delete(task.id)

      return task
    }

    return
  }

  /**
   * 当前时间片是否应让出主线程。
   */
  const shouldYield = (
    sliceStartedAt: number,
    idleDeadline: IdleDeadlineLike | undefined
  ): boolean => {
    if (idleDeadline && !idleDeadline.didTimeout && idleDeadline.timeRemaining() <= 0) {
      return true
    }

    return getCurrentTime() - sliceStartedAt >= timeSliceMs
  }

  /**
   * 空闲预算耗尽且没有前台任务时，结束本次 idle 回调并等待下一次机会。
   */
  const shouldPauseForIdleDeadline = (
    idleDeadline: IdleDeadlineLike | undefined
  ): boolean => {
    return Boolean(
      idleDeadline &&
      !idleDeadline.didTimeout &&
      idleDeadline.timeRemaining() <= 0 &&
      !hasQueuedNonIdleTasks()
    )
  }

  /**
   * 跟踪异步任务。
   *
   * 增加飞行中任务计数，任务完成后减少计数并检查空闲状态。
   * 用于确保 whenIdle 能正确等待所有异步任务完成。
   */
  const track = async <TResult>(
    promise: Promise<TResult>,
    options: SchedulerTrackOptions = {}
  ): Promise<TResult> => {
    return await trackCancellable(promise, options).promise
  }

  /**
   * 将异步工作作为可取消的逻辑任务纳入 idle 判断。
   */
  const trackCancellable = <TResult>(
    promise: Promise<TResult>,
    options: SchedulerTrackOptions = {}
  ): CancellableTask<TResult> => {
    const task = {}

    const isCritical = options.priority !== "idle"

    let settled = false

    const settle = (): void => {
      if (settled) {
        return
      }

      settled = true
      pendingTasks.delete(task)
      notifyIdleIfNeeded()
    }

    pendingTasks.set(task, isCritical)
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
  const whenIdle = (
    timeoutOrOptions: number | SchedulerIdleOptions = 10000
  ): Promise<boolean> => {
    const idleOptions = normalizeIdleOptions(timeoutOrOptions)

    if (isIdle(idleOptions.includeIdle)) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const waiter: IdleWaiter = {
        resolve,
        includeIdle: idleOptions.includeIdle,
      }

      waiter.timeoutId = globalThis.setTimeout(() => {
        settleIdleWaiter(waiter, false)
      }, idleOptions.timeout)

      idleWaiters.add(waiter)
    })
  }

  /**
   * 检查调度器是否空闲。
   *
   * 空闲条件：无正在执行的 flush、无飞行中异步任务、队列为空。
   */
  const isIdle = (includeIdle = true): boolean => {
    const hasActiveTasks = includeIdle ? currentFlush !== null : activeCriticalTasks > 0

    const hasPendingTasks = includeIdle
      ? pendingTasks.size > 0
      : hasCriticalPendingTasks()

    const hasQueuedWork = includeIdle ? hasQueuedTasks() : hasQueuedNonIdleTasks()

    return !hasActiveTasks && !hasPendingTasks && !hasQueuedWork
  }

  /**
   * 检查是否有待执行任务。
   */
  const hasQueuedTasks = (): boolean => {
    return Array.from(queues.values()).some((queue) => queue.size > 0)
  }

  /**
   * 检查是否有待执行的 normal 或 post 任务。
   */
  const hasQueuedNonIdleTasks = (): boolean => {
    return PRIORITY_ORDER.some(
      (priority) => priority !== "idle" && (queues.get(priority)?.size ?? 0) > 0
    )
  }

  /**
   * 检查是否有待执行的 idle 任务。
   */
  const hasQueuedIdleTasks = (): boolean => {
    return (queues.get("idle")?.size ?? 0) > 0
  }

  /**
   * 检查是否有参与关键空闲判断的异步任务。
   */
  const hasCriticalPendingTasks = (): boolean => {
    return Array.from(pendingTasks.values()).some((isCritical) => isCritical)
  }

  /**
   * 检查当前 flush 是否还有可执行任务，避免最后一个任务后额外让出一次主线程。
   */
  const hasTasksForCurrentFlush = (): boolean => {
    return hasQueuedNonIdleTasks() || (shouldFlushIdleTasks && hasQueuedIdleTasks())
  }

  /**
   * 如果空闲则通知所有等待者。
   */
  const notifyIdleIfNeeded = (): void => {
    const waiters = Array.from(idleWaiters)

    waiters.forEach((waiter) => {
      if (isIdle(waiter.includeIdle)) {
        settleIdleWaiter(waiter, true)
      }
    })
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
    shouldFlushIdleTasks = false
    queues.forEach((queue) => queue.clear())
    pendingTasks.clear()

    const waiters = Array.from(idleWaiters)

    waiters.forEach((waiter) => settleIdleWaiter(waiter, false))
  }

  /**
   * 读取当前队列、让出次数和最长同步任务耗时。
   */
  const getDiagnostics = (): SchedulerDiagnostics => {
    const queued = {
      normal: queues.get("normal")?.size ?? 0,
      post: queues.get("post")?.size ?? 0,
      idle: queues.get("idle")?.size ?? 0,
    }

    return {
      queued,
      yieldedCount: collectDiagnostics ? yieldedCount : 0,
      maxTaskDurationMs: collectDiagnostics ? maxTaskDurationMs : 0,
    }
  }

  return {
    schedule,
    flush,
    whenIdle,
    track,
    trackCancellable,
    dispose,
    getDiagnostics,
  }
}

/**
 * 读取单调递增的当前时间，浏览器和非浏览器运行时均可用。
 */
function getCurrentTime(): number {
  return globalThis.performance?.now() ?? Date.now()
}

/**
 * 让出当前事件循环，使浏览器有机会处理输入和绘制。
 */
export function yieldToHost(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") {
      globalThis.setTimeout(resolve, 0)

      return
    }

    const channel = new MessageChannel()

    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      resolve()
    }

    channel.port2.postMessage(undefined)
  })
}

/**
 * 规范化空闲等待参数，保留旧的数字参数形式。
 */
function normalizeIdleOptions(
  timeoutOrOptions: number | SchedulerIdleOptions
): Required<SchedulerIdleOptions> {
  if (typeof timeoutOrOptions === "number") {
    return {
      timeout: timeoutOrOptions,
      includeIdle: true,
    }
  }

  return {
    timeout: timeoutOrOptions.timeout ?? 10000,
    includeIdle: timeoutOrOptions.includeIdle ?? true,
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
