/**
 * 最新结果优先的异步任务运行器，借用所属资源 Scope。
 */
import type { Scope } from "../node"
import type { CancellableTask, Scheduler } from "./scheduler"

/**
 * 一组可独立停止的任务；停止 runner 不会释放其父资源。
 */
export interface AbortableTaskRunner<TValue = void> {
  /**
   * 执行新任务并取消旧任务；关闭、过期或失败时返回 undefined。
   */
  run(): Promise<TValue | undefined>
  /**
   * 停止任务并解除父 Scope 上的清理登记。
   */
  dispose(): void
}

/**
 * 任务依赖和最新一轮的通知。
 */
export interface AbortableTaskRunnerOptions<TValue = void> {
  /**
   * 借用的所属 Scope；runner 不创建子 Scope。
   */
  readonly scope: Scope
  /**
   * 接收异步逻辑任务的统一完成边界。
   */
  readonly scheduler: Scheduler
  /**
   * @param signal - 新请求创建或资源销毁时中止的信号。
   */
  run(signal: AbortSignal): Promise<TValue> | TValue
  /**
   * @param controller - 此轮任务的取消控制器。
   */
  onStart?(controller: AbortController): void
  /**
   * @param value - 只有当前有效任务能够提交的结果。
   */
  onSuccess?(value: TValue): void
  /**
   * @param error - 最新任务执行失败的规范化异常。
   */
  onError?(error: Error): void
  /**
   * 最新任务结束时通知；过期或中止任务不通知。
   */
  onSettled?(): void
}

/**
 * 创建可独立释放的 runner，只在所属 Scope 登记一个清理句柄。
 * @param options - 所属资源、调度器、任务及其通知。
 * @example
 * const runner = createAbortableTaskRunner({ scope, scheduler, run: () => 42 })
 * await runner.run()
 * runner.dispose()
 */
export function createAbortableTaskRunner<TValue = void>(
  options: AbortableTaskRunnerOptions<TValue>
): AbortableTaskRunner<TValue> {
  // 每次执行或关闭都让旧版本失效。
  let version = 0

  // runner 的独立终态，不改变所属 Scope 的存活状态。
  let closed = false

  // 当前取消控制器与逻辑任务登记互相独立。
  let controller: AbortController | undefined

  // 此轮参与 Scheduler 完成判断的逻辑登记。
  let activeTask: CancellableTask<TValue | undefined> | undefined

  /**
   * 先发布终态，再触发可能重入的 abort 监听器。
   */
  const stop = (): void => {
    if (closed) {
      return
    }

    closed = true
    version += 1
    activeTask?.cancel()
    activeTask = undefined
    controller?.abort()
    controller = undefined
  }

  // 已关闭的父 Scope 会立即执行 stop，无需额外终态分支。
  const cleanup = options.scope.add(stop)

  /**
   * 判断当前通知是否仍属于有效请求。
   * @param currentVersion - 启动此轮任务时的版本。
   * @param currentController - 此轮任务独占的控制器。
   */
  const isStale = (currentVersion: number, currentController: AbortController): boolean =>
    closed ||
    options.scope.disposed ||
    currentController.signal.aborted ||
    currentVersion !== version

  /**
   * 执行通知和任务；回调可能同步释放或重启 runner，每步后重新检查有效性。
   * @param currentVersion - 此轮执行版本。
   * @param currentController - 此轮取消控制器。
   */
  const runCurrentTask = async (
    currentVersion: number,
    currentController: AbortController
  ): Promise<TValue | undefined> => {
    try {
      options.onStart?.(currentController)
      if (isStale(currentVersion, currentController)) {
        return
      }

      // 同步任务也经由 await 进入统一的结果提交检查。
      const value = await options.run(currentController.signal)

      if (isStale(currentVersion, currentController)) {
        return
      }

      options.onSuccess?.(value)
      if (!isStale(currentVersion, currentController)) {
        options.onSettled?.()
      }

      return value
    } catch (cause) {
      if (isStale(currentVersion, currentController)) {
        return
      }

      // 规范化异常，不让业务错误处理器制造未处理的 rejection。
      const error = cause instanceof Error ? cause : new Error(String(cause))

      try {
        if (options.onError) {
          options.onError(error)
        } else {
          console.error("[schemx] 可中止任务执行错误", error)
        }

        if (!isStale(currentVersion, currentController)) {
          options.onSettled?.()
        }
      } catch (handlerError) {
        console.error("[schemx] 任务错误处理器执行错误", handlerError)
      }
    }
  }

  /**
   * 以新身份替换旧任务，再取消旧操作，避免 abort 回调重入覆盖新状态。
   * @example await runner.run()
   */
  const run = async (): Promise<TValue | undefined> => {
    if (closed || options.scope.disposed) {
      return
    }

    // 先保留旧资源，再把此轮登记为最新身份。
    const previousTask = activeTask

    // 旧请求的底层取消控制器，与旧逻辑登记一起替换。
    const previousController = controller

    // 此轮身份在 abort 旧请求前发布，防止取消监听器重入。
    const currentVersion = ++version

    // 本次请求独占的底层取消域。
    const currentController = new AbortController()

    controller = currentController
    activeTask = undefined
    previousController?.abort()
    if (isStale(currentVersion, currentController)) {
      previousTask?.cancel()

      return
    }

    // onStart 和 run 都可能同步重入，因此登记后仍需复查版本。
    const task = options.scheduler.trackCancellable(
      runCurrentTask(currentVersion, currentController)
    )

    if (isStale(currentVersion, currentController)) {
      task.cancel()
    } else {
      activeTask = task
    }

    // 先登记新工作再移除旧工作，完成等待不能观察到替换过程中的空隙。
    previousTask?.cancel()

    try {
      return await task.promise
    } finally {
      if (activeTask === task) {
        activeTask = undefined
      }
    }
  }

  /**
   * 通过同一清理记录停止 runner；父 Scope 中不再保留已停止的 runner。
   * @example runner.dispose()
   */
  const dispose = (): void => cleanup.dispose()

  return { run, dispose }
}
