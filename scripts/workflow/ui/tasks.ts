// 任意操作和子进程与任务反馈的组合，不持有范围或进程记录。
import type {
  CommandResult,
  ExecuteCommandOptions,
  TerminalCommands,
} from "./commands.ts"
import type { StartTaskOptions, TerminalScopes } from "./scopes.ts"

/**
 * 组合命令执行和任务反馈，输出策略与独立命令一致。
 */
export interface RunCommandOptions extends ExecuteCommandOptions, StartTaskOptions {}

/**
 * 回调原值与最终返回值保持类型关联。
 * @typeParam TResult - 操作产生的领域结果。
 */
export interface RunTaskOptions<TResult> extends StartTaskOptions {
  /**
   * 操作完成即记录成功，抛出异常即记录失败；返回值不参与状态推断。
   */
  readonly execute: () => TResult | Promise<TResult>
}

/**
 * 公开任务与命令的便捷组合能力。
 */
export interface TerminalTasks {
  /**
   * 执行命令并反馈任务状态，非零退出返回结果，启动异常透传。
   * @param options - 命令配置及任务反馈所需的名称、目标和父范围。
   * @example await terminal.runCommand({ title: "构建", command: "pnpm", args: ["build"] })
   */
  runCommand(this: void, options: RunCommandOptions): Promise<CommandResult>
  /**
   * 自动完成任务反馈，返回回调原值并透传异常。
   * @typeParam TResult - 操作产生的领域结果。
   * @param options - 任务元数据及操作回调。
   * @example const result = await terminal.runTask({ title: "计算", execute: () => 42 })
   */
  runTask<TResult>(this: void, options: RunTaskOptions<TResult>): Promise<TResult>
}

// 所有状态归所属模块，本模块只组合必要操作。
interface TasksOptions {
  // 开始与结束反馈使用同一实例的范围操作。
  readonly startTask: TerminalScopes["startTask"]
  // 成功与其他收尾方式复用范围模块的幂等控制。
  readonly succeedTask: TerminalScopes["succeedTask"]
  // 失败反馈接收原始异常，不在组合层重新格式化。
  readonly failTask: TerminalScopes["failTask"]
  // 取消仅更新范围反馈。
  readonly cancelTask: TerminalScopes["cancelTask"]
  // 子进程由命令模块拥有和跟踪。
  readonly executeCommand: TerminalCommands["executeCommand"]
  // 释放后不再追加任务反馈。
  readonly isDisposed: () => boolean
  // 接管信号时等待统一宿主退出。
  readonly getSignalExit: () => Promise<never> | undefined
}

/**
 * 将执行与任务反馈组合，不持有范围记录或子进程集合。
 * @param options - 范围、命令及会话查询的最小依赖。
 * @example const tasks = createTasks({ startTask, succeedTask, failTask, cancelTask, executeCommand, isDisposed, getSignalExit })
 */
export function createTasks(options: TasksOptions): TerminalTasks {
  // 传入操作均为闭包方法，不依赖 this 或完整 Terminal。
  const {
    startTask,
    succeedTask,
    failTask,
    cancelTask,
    executeCommand,
    isDisposed,
    getSignalExit,
  } = options

  // 将任意回调与任务反馈组合，返回原值并重新抛出原始异常。
  const runTask: TerminalTasks["runTask"] = async <TResult>(
    options: RunTaskOptions<TResult>
  ): Promise<TResult> => {
    // 组合操作自行持有任务标识，避免依赖隐式当前任务。
    const taskId = startTask(options)

    try {
      // 保留执行器或业务回调的原始结果，不额外复制或解释业务值。
      const result = await options.execute()

      // 执行后读取实时屏障，避免使用实例创建时的旧值。
      const signalExit = getSignalExit()

      if (signalExit) {
        await signalExit
      }

      if (!isDisposed()) {
        succeedTask({ taskId })
      }

      return result
    } catch (failure) {
      // 执行后读取实时屏障，避免使用实例创建时的旧值。
      const signalExit = getSignalExit()

      if (signalExit) {
        await signalExit
      }

      if (isDisposed()) {
        throw failure
      }

      if (failure instanceof Error && failure.name === "AbortError") {
        cancelTask({ taskId })
      } else {
        failTask({ taskId, error: failure })
      }

      throw failure
    }
  }

  // 按命令退出码或终止信号反馈结果，不把非零退出转换成异常。
  const runCommand: TerminalTasks["runCommand"] = async (
    options: RunCommandOptions
  ): Promise<CommandResult> => {
    // 组合操作自行持有任务标识，避免依赖隐式当前任务。
    const taskId = startTask(options)

    try {
      // 保留执行器或业务回调的原始结果，不额外复制或解释业务值。
      const result = await executeCommand(options)

      if (isDisposed()) {
        return result
      }

      if (result.exitCode === 0) {
        succeedTask({ taskId })
      } else if (result.signal === "SIGINT" || result.signal === "SIGTERM") {
        cancelTask({ taskId })
      } else {
        failTask({
          taskId,
          message: result.exitCode === null ? undefined : `exit ${result.exitCode}`,
        })
      }

      return result
    } catch (failure) {
      // 执行后读取实时屏障，避免使用实例创建时的旧值。
      const signalExit = getSignalExit()

      if (signalExit) {
        await signalExit
      }

      if (isDisposed()) {
        throw failure
      }

      if (failure instanceof Error && failure.name === "AbortError") {
        cancelTask({ taskId })
      } else {
        failTask({ taskId, error: failure })
      }

      throw failure
    }
  }

  return { runTask, runCommand }
}
