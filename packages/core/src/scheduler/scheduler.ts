/**
 * normal/post 两阶段 keyed 任务队列及统一异步完成边界。
 */
import type { Scope } from "../node"

/**
 * 依赖计算先于校验注册；每次取任务都重新检查 normal 队列。
 */
export type SchedulerTaskPriority = "normal" | "post"

/**
 * 调度器的时间片和诊断配置。
 */
export interface SchedulerOptions {
  /**
   * 连续同步工作的时间预算（毫秒），默认 5；只能在任务边界让出。
   */
  readonly timeSliceMs?: number
  /**
   * 是否收集诊断数据，默认 false。
   */
  readonly collectDiagnostics?: boolean
}

/**
 * 调度器当前的队列及同步执行统计。
 */
export interface SchedulerDiagnostics {
  /**
   * 各阶段尚未执行的任务数量。
   */
  readonly queued: Readonly<Record<SchedulerTaskPriority, number>>
  /**
   * 为时间片让出主线程的次数。
   */
  readonly yieldedCount: number
  /**
   * 同步执行部分的最长耗时（毫秒）。
   */
  readonly maxTaskDurationMs: number
}

/**
 * 队列中的一次工作，相同阶段及 ID 的待执行任务只保留最后一次。
 */
export interface ScheduledTask {
  /**
   * 当前阶段内的去重标识。
   */
  readonly id: string
  /**
   * 本次任务的执行阶段。
   */
  readonly priority: SchedulerTaskPriority
  /**
   * 已释放作用域中的待执行任务会被跳过。
   */
  readonly scope?: Scope
  /**
   * 执行同步工作或需要队列等待的异步工作。
   */
  run(): void | Promise<void>
  /**
   * @param error - 本次执行抛出的异常。
   */
  onError?(error: unknown): void
}

/**
 * 可提前退出完成等待的逻辑任务；底层操作由调用方负责中止。
 */
export interface CancellableTask<TResult> {
  /**
   * 原始异步工作，不因 cancel 而改变结果。
   */
  readonly promise: Promise<TResult>
  /**
   * 从调度器完成判断中移除此任务，可以重复调用。
   */
  cancel(): void
}

/**
 * 队列执行和外部异步工作共用的完成边界。
 */
export interface Scheduler {
  /**
   * @param task - 要加入队列的工作。
   */
  schedule(task: ScheduledTask): void
  /**
   * 执行队列中的工作，复用正在执行的 flush。
   */
  flush(): Promise<void>
  /**
   * 等待所有队列、执行中工作和异步任务完成；超时或销毁返回 false。
   * @param timeout - 最长等待毫秒数，默认 10000。
   */
  whenIdle(timeout?: number): Promise<boolean>
  /**
   * @param promise - 要纳入完成等待的异步工作。
   */
  track<TResult>(promise: Promise<TResult>): Promise<TResult>
  /**
   * @param promise - 可由调用方提前标记失效的异步工作。
   */
  trackCancellable<TResult>(promise: Promise<TResult>): CancellableTask<TResult>
  /**
   * 停止执行任务并以 false 结束所有尚未完成的等待。
   */
  dispose(): void
  /**
   * 读取当前诊断数据。
   */
  getDiagnostics(): SchedulerDiagnostics
}

/**
 * 独立等待者的完成函数和超时定时器。
 */
interface IdleWaiter {
  /**
   * @param idle - 全部工作完成时为 true，超时或销毁时为 false。
   */
  readonly resolve: (idle: boolean) => void
  /**
   * 此等待者的超时句柄。
   */
  readonly timeoutId: ReturnType<typeof globalThis.setTimeout>
}

/**
 * 每个任务边界都按此顺序选取工作。
 */
const PRIORITY_ORDER: readonly SchedulerTaskPriority[] = ["normal", "post"]

/**
 * 创建具有任务去重、时间片和异步完成等待的调度器。
 * @param options - 同步时间预算及诊断开关。
 * @example
 * const scheduler = createScheduler()
 * scheduler.schedule({ id: "field", priority: "normal", run: () => {} })
 * await scheduler.whenIdle()
 * scheduler.dispose()
 */
export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  // 时间片只统计任务边界间的同步工作。
  const timeSliceMs = options.timeSliceMs ?? 5

  // 关闭诊断时不累计统计量。
  const collectDiagnostics = options.collectDiagnostics ?? false

  // 各阶段内按 ID 覆盖待执行任务。
  const queues = new Map<SchedulerTaskPriority, Map<string, ScheduledTask>>(
    PRIORITY_ORDER.map((priority) => [priority, new Map()])
  )

  // 外部异步工作和独立等待者分别登记。
  const pendingTasks = new Set<object>()

  // 每个等待者保留独立超时和交付状态。
  const idleWaiters = new Set<IdleWaiter>()

  // flush 状态覆盖同步执行、异步等待和主线程让出。
  let disposed = false

  // 在异步执行体创建 Promise 前也能阻止重入启动第二轮。
  let flushing = false

  // 复用当前队列执行的完成句柄。
  let currentFlush: Promise<void> | undefined

  // 同一轮最多保留一个自动刷新 microtask。
  let flushScheduled = false

  // 可选诊断累积值。
  let yieldedCount = 0

  // 单个任务同步执行部分的最长耗时。
  let maxTaskDurationMs = 0

  /**
   * 当前是否还有任一阶段的待执行工作。
   */
  const hasQueuedTasks = (): boolean =>
    // priority 为当前检查的队列阶段。
    PRIORITY_ORDER.some((priority) => (queues.get(priority)?.size ?? 0) > 0)

  /**
   * 只有整轮 flush 和所有外部异步工作结束才算完成。
   */
  const isIdle = (): boolean => !flushing && !hasQueuedTasks() && pendingTasks.size === 0

  /**
   * 结束一个等待并撤销其超时。
   * @param waiter - 本次要交付的等待者。
   * @param idle - 已完成全部工作或因超时/销毁结束。
   */
  const settleWaiter = (waiter: IdleWaiter, idle: boolean): void => {
    if (idleWaiters.delete(waiter)) {
      globalThis.clearTimeout(waiter.timeoutId)
      waiter.resolve(idle)
    }
  }

  /**
   * 通知同一完成边界上的所有等待者。
   */
  const notifyIdle = (): void => {
    if (!disposed && isIdle()) {
      for (const waiter of [...idleWaiters]) {
        settleWaiter(waiter, true)
      }
    }
  }

  /**
   * 跟踪逻辑任务；取消只影响完成判断，不影响原始 Promise。
   * @param promise - 需要跟踪的异步工作。
   * @example const task = scheduler.trackCancellable(request); task.cancel()
   */
  const trackCancellable = <TResult>(
    promise: Promise<TResult>
  ): CancellableTask<TResult> => {
    // 每个登记都有独立身份，相同 Promise 可以多次登记。
    const task = {}

    if (!disposed) {
      pendingTasks.add(task)
    }

    /**
     * 幂等移除逻辑工作，并重新检查完成边界。
     */
    const cancel = (): void => {
      if (pendingTasks.delete(task)) {
        notifyIdle()
      }
    }

    void promise.then(cancel, cancel)

    return { promise, cancel }
  }

  /**
   * 等待被跟踪的 Promise，同时把它纳入调度器完成判断。
   * @param promise - 本次异步工作。
   * @example await scheduler.track(Promise.resolve())
   */
  const track = <TResult>(promise: Promise<TResult>): Promise<TResult> =>
    trackCancellable(promise).promise

  /**
   * 从最高优先级非空队列取出并移除一个任务。
   */
  const takeNextTask = (): ScheduledTask | undefined => {
    for (const priority of PRIORITY_ORDER) {
      // queue/task 分别为当前阶段队列及其中最早登记的工作。
      const queue = queues.get(priority)

      const task = queue?.values().next().value

      if (task) {
        queue?.delete(task.id)

        return task
      }
    }

    return undefined
  }

  /**
   * 连续执行队列工作，必要时在任务边界让出主线程。
   */
  const flushOnce = async (): Promise<void> => {
    // 异步任务完成后重新开始计算同步时间片。
    let sliceStartedAt = getCurrentTime()

    while (!disposed) {
      // 每轮重新选择阶段，post 新增的 normal 会先于剩余 post 执行。
      const task = takeNextTask()

      if (!task) {
        return
      }

      if (task.scope?.disposed) {
        continue
      }

      try {
        // 只统计 run 的同步部分，不把网络等待计入最长任务耗时。
        const taskStartedAt = getCurrentTime()

        const result = task.run()

        if (collectDiagnostics) {
          maxTaskDurationMs = Math.max(
            maxTaskDurationMs,
            getCurrentTime() - taskStartedAt
          )
        }

        if (result) {
          await track(result)
          sliceStartedAt = getCurrentTime()
        }
      } catch (error) {
        // 业务错误处理器抛错同样不应中断剩余队列。
        try {
          if (task.onError) {
            task.onError(error)
          } else {
            console.error(`[schemx] 调度任务 "${task.id}" 执行错误`, error)
          }
        } catch (handlerError) {
          console.error("[schemx] 调度任务错误处理器执行错误", handlerError)
        }
      }

      if (getCurrentTime() - sliceStartedAt >= timeSliceMs && hasQueuedTasks()) {
        await yieldToHost()
        if (collectDiagnostics) {
          yieldedCount += 1
        }

        sliceStartedAt = getCurrentTime()
      }
    }
  }

  /**
   * 执行队列，正在执行的 flush 由所有调用者共享。
   * @example await scheduler.flush()
   */
  const flush = (): Promise<void> => {
    if (disposed) {
      return Promise.resolve()
    }

    if (flushing) {
      // run 内部重入时异步执行体尚未返回 Promise，延迟读取同一轮句柄。
      return currentFlush ?? Promise.resolve().then(() => currentFlush)
    }

    flushing = true
    currentFlush = flushOnce().finally(() => {
      flushing = false
      currentFlush = undefined
      notifyIdle()
      if (hasQueuedTasks() && !disposed) {
        scheduleFlush()
      }
    })

    return currentFlush
  }

  /**
   * 同一轮最多安排一次 microtask；flush 中新增工作由当前执行循环消费。
   */
  const scheduleFlush = (): void => {
    if (flushScheduled || flushing || disposed) {
      return
    }

    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      void flush()
    })
  }

  /**
   * 按阶段和任务 ID 登记工作。
   * @param task - 本次待执行任务。
   * @example scheduler.schedule({ id: "x", priority: "post", run: () => {} })
   */
  const schedule = (task: ScheduledTask): void => {
    if (disposed || task.scope?.disposed) {
      return
    }

    queues.get(task.priority)?.set(task.id, task)
    scheduleFlush()
  }

  /**
   * 等待统一完成边界，所有等待者独立计时。
   * @param timeout - 最长等待毫秒数，默认 10000。
   * @example const ready = await scheduler.whenIdle(1000)
   */
  const whenIdle = (timeout = 10000): Promise<boolean> => {
    if (disposed) {
      return Promise.resolve(false)
    }

    if (isIdle()) {
      return Promise.resolve(true)
    }

    // resolve 为当前等待者的结果接收函数。
    return new Promise((resolve) => {
      // waiter 在超时回调真正执行前完成初始化。
      const waiter: IdleWaiter = {
        resolve,
        timeoutId: globalThis.setTimeout(() => settleWaiter(waiter, false), timeout),
      }

      idleWaiters.add(waiter)
    })
  }

  /**
   * 清空工作登记并以失败状态结束等待，底层请求由所属资源负责中止。
   * @example scheduler.dispose()
   */
  const dispose = (): void => {
    disposed = true
    for (const queue of queues.values()) {
      queue.clear()
    }

    pendingTasks.clear()
    for (const waiter of [...idleWaiters]) {
      settleWaiter(waiter, false)
    }
  }

  /**
   * 读取不暴露内部队列的统计快照。
   * @example const diagnostics = scheduler.getDiagnostics()
   */
  const getDiagnostics = (): SchedulerDiagnostics => ({
    queued: {
      normal: queues.get("normal")?.size ?? 0,
      post: queues.get("post")?.size ?? 0,
    },
    yieldedCount: collectDiagnostics ? yieldedCount : 0,
    maxTaskDurationMs: collectDiagnostics ? maxTaskDurationMs : 0,
  })

  return { schedule, flush, whenIdle, track, trackCancellable, dispose, getDiagnostics }
}

/**
 * 读取浏览器和 Node 都支持的单调时间。
 */
function getCurrentTime(): number {
  return globalThis.performance?.now() ?? Date.now()
}

/**
 * 让出事件循环，让输入、绘制或其他任务有机会运行。
 * @example await yieldToHost()
 */
export function yieldToHost(): Promise<void> {
  // resolve 在一个新的宿主事件循环阶段执行。
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") {
      globalThis.setTimeout(resolve, 0)

      return
    }

    // channel 仅为本次让出创建，收到消息后关闭两端。
    const channel = new MessageChannel()

    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      resolve()
    }

    channel.port2.postMessage(undefined)
  })
}
