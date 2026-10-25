// 单个实例的可用性、取消、外部清理和延迟释放。
/**
 * 信号监听接收一个具名载荷，并可执行异步清理。
 */
export interface TerminalSignal {
  /**
   * 触发取消和清理的系统信号。
   */
  readonly signal: "SIGINT" | "SIGTERM"
  /**
   * 退出约定：SIGINT 为 130，SIGTERM 为 143。
   */
  readonly exitCode: number
}

/**
 * 在实例接管系统信号时执行清理，异常会被记录并继续后续清理。
 * @param event - 本轮信号及其统一退出码。
 */
export type SignalListener = (event: TerminalSignal) => void | Promise<void>

/**
 * 注册实例的信号清理回调，注销只影响本回调。
 */
export interface OnSignalOptions {
  /**
   * 按注册顺序执行的清理函数，可返回 Promise 等待异步资源释放。
   */
  readonly listener: SignalListener
}

/**
 * 公开实例状态、信号订阅和资源释放能力。
 */
export interface TerminalSession {
  /**
   * 实时反映实例是否已进入信号取消流程。
   */
  readonly isCancelled: boolean
  /**
   * 订阅信号清理，支持异步回调，返回幂等的取消订阅函数。
   * @param options - 支持异步清理的信号监听函数。
   * @example const unsubscribe = terminal.onSignal({ listener: async () => { await closeResources() } })
   */
  onSignal(this: void, options: OnSignalOptions): () => void
  /**
   * 释放本实例的监听和交互资源；幂等且不主动退出宿主。
   * @example terminal.dispose()
   */
  dispose(this: void): void
}

// 一次释放分为注销输入监听和释放其余资源，中间由 session 中止自有操作。
interface DisposeSessionOptions {
  // 先移除系统及按键监听，避免释放期间继续接收新输入。
  readonly unsubscribe: () => void
  // AbortController 已中止后释放模块自有资源。
  readonly release: () => void
}

// 清理错误交给消息模块显示，session 不格式化或直接写终端。
interface CleanSignalOptions {
  // 本轮所有监听共享的信号载荷。
  readonly event: TerminalSignal
  /**
   * 记录单个监听抛出的错误，之后继续剩余清理。
   * @param failure - 原始清理异常。
   */
  readonly reportError: (failure: unknown) => void
}

/**
 * 实例内部控制能力；不作为公共 Terminal 对象整体导出。
 */
export interface Session {
  /**
   * 实例统一持有的命令与交互取消信号。
   */
  readonly signal: AbortSignal
  /**
   * 校验实例仍可输出或注册清理。
   */
  check(this: void): void
  /**
   * 开始操作前同时校验实例未释放、未取消。
   */
  checkExecution(this: void): void
  /**
   * 返回当前取消状态，供公共只读属性使用。
   */
  getCancelled(this: void): boolean
  /**
   * 返回释放状态，防止异步操作在释放后追加反馈。
   */
  isDisposed(this: void): boolean
  /**
   * 查询是否处于系统信号清理阶段。
   */
  isHandlingSignal(this: void): boolean
  /**
   * 查询是否已允许范围写最终结束标记。
   */
  isFinalizing(this: void): boolean
  /**
   * 信号接管后提供宿主退出屏障，普通取消时不存在。
   */
  getSignalExit(this: void): Promise<never> | undefined
  /**
   * 注册外部清理并返回幂等注销函数。
   * @param options - 原始公开信号监听配置。
   */
  onSignal(this: void, options: OnSignalOptions): () => void
  /**
   * 同步标记取消并中止实例的命令和交互。
   */
  beginSignal(this: void): void
  /**
   * 按固定订阅快照顺序等待外部资源清理。
   * @param options - 本轮信号及错误记录操作。
   */
  cleanSignal(this: void, options: CleanSignalOptions): Promise<void>
  /**
   * 全部清理结束后允许范围最终收尾。
   */
  beginFinalizing(this: void): void
  /**
   * 请求释放；信号清理阶段暂存资源释放操作。
   * @param options - 注销监听和释放资源的已绑定操作。
   */
  dispose(this: void, options: DisposeSessionOptions): void
  /**
   * 范围收尾之后处理清理阶段提出的释放请求。
   */
  finishDisposal(this: void): void
}

/**
 * 创建实例的会话状态，不安装系统监听或创建展示模块。
 * @example const session = createSession()
 */
export function createSession(): Session {
  // 实例拥有这个控制器，注入的输入输出流不随它关闭。
  const abort = new AbortController()

  // 外部清理只存放于当前实例，运行时另取快照。
  const listeners = new Set<SignalListener>()

  // 释放后拒绝新操作，重复释放不会调用资源回调。
  let disposed = false

  // 信号取消后不再允许启动新命令或范围。
  let cancelled = false

  // 清理期间允许输出，但推迟范围结束和资源释放。
  let handlingSignal = false

  // 最终收尾阶段允许范围输出一次取消结果。
  let finalizing = false

  // 屏障本身不持有事件循环；进程协调器负责等待清理并退出。
  let signalExit: Promise<never> | undefined

  // 存在即表示清理回调提出了释放请求，避免重复维护一个布尔状态。
  let pendingDisposal: DisposeSessionOptions | undefined

  // 释放后不再允许输出、订阅或执行。
  const check = (): void => {
    if (disposed) {
      throw new Error("终端实例已释放。")
    }
  }

  // 输出清理信息仍可用，但取消后禁止创建新操作。
  const checkExecution = (): void => {
    check()
    if (cancelled) {
      throw new DOMException("操作已取消。", "AbortError")
    }
  }

  // 这些查询均读取唯一状态，不维护额外副本。
  const getCancelled = (): boolean => cancelled

  // 异步组合通过此查询决定是否还能追加反馈。
  const isDisposed = (): boolean => disposed

  // 范围模块通过此查询延后普通结束请求。
  const isHandlingSignal = (): boolean => handlingSignal

  // 只有清理完成后范围模块才允许最终收尾。
  const isFinalizing = (): boolean => finalizing

  // 执行模块每次读取当前屏障，避免缓存创建时的 undefined。
  const getSignalExit = (): Promise<never> | undefined => signalExit

  // 公开信号订阅不管理进程级监听所有权。
  const onSignal: TerminalSession["onSignal"] = ({ listener }) => {
    check()
    listeners.add(listener)
    // Set.delete 使注销幂等且只影响当前函数。
    const unsubscribe = (): void => {
      listeners.delete(listener)
    }

    return unsubscribe
  }

  // 先设置屏障再中止操作，AbortError 不会抢先结束宿主。
  const beginSignal = (): void => {
    cancelled = true
    handlingSignal = true
    signalExit = new Promise<never>(() => {})
    abort.abort()
  }

  // 单个监听异常不会阻止其他外部资源收尾。
  const cleanSignal: Session["cleanSignal"] = async ({ event, reportError }) => {
    // 本轮固定快照，不受回调内取消订阅影响。
    const cleanups = [...listeners]

    // 回调按注册顺序串行执行，输出顺序也保持不变。
    for (const listener of cleanups) {
      try {
        await listener(event)
      } catch (failure) {
        reportError(failure)
      }
    }
  }

  // 状态切换与具体的范围展示分开，由组合入口协调阶段顺序。
  const beginFinalizing = (): void => {
    finalizing = true
  }

  /**
   * 在正确阶段释放资源，不关闭宿主提供的流。
   * @param options - 由组合入口装配的资源操作。
   */
  const release = (options: DisposeSessionOptions): void => {
    if (disposed) {
      return
    }

    disposed = true
    options.unsubscribe()
    abort.abort()
    listeners.clear()
    options.release()
    pendingDisposal = undefined
  }

  // 信号清理期间仅记录请求，后续清理仍可使用消息和控件资源。
  const dispose: Session["dispose"] = (options) => {
    if (handlingSignal && !finalizing) {
      pendingDisposal = options

      return
    }

    release(options)
  }

  // 只有明确提出的延迟释放请求才执行释放。
  const finishDisposal = (): void => {
    if (pendingDisposal) {
      release(pendingDisposal)
    }
  }

  // 对象只组装已经声明的操作，不在返回对象内定义行为。
  const session: Session = {
    signal: abort.signal,
    check,
    checkExecution,
    getCancelled,
    isDisposed,
    isHandlingSignal,
    isFinalizing,
    getSignalExit,
    onSignal,
    beginSignal,
    cleanSignal,
    beginFinalizing,
    dispose,
    finishDisposal,
  }

  return session
}
