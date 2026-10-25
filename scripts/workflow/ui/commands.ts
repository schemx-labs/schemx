// 子进程执行与运行中进程跟踪，不生成任务反馈。
import { spawn } from "node:child_process"

import type { Renderer } from "./renderer.ts"

/**
 * 子进程输出策略。inherit 保留 TTY，采集模式使用管道。
 */
export type OutputMode = "inherit" | "capture" | "tee"

/**
 * 执行独立子进程，单次配置覆盖工厂默认值；不经过 shell。
 */
export interface ExecuteCommandOptions {
  /**
   * 直接传给 spawn 的可执行文件。
   */
  readonly command: string
  /**
   * 逐个传递的参数，不拼接为 shell 命令。
   */
  readonly args?: readonly string[]
  /**
   * 单次工作目录，默认使用工厂目录。
   */
  readonly cwd?: string | undefined
  /**
   * 单次环境覆盖，与实例环境合并。
   */
  readonly env?: NodeJS.ProcessEnv | undefined
  /**
   * 默认 inherit；capture 和 tee 使用管道，不保留子进程的原生 TTY。
   */
  readonly outputMode?: OutputMode
  /**
   * 可选 stdin 文本；提供时使用管道并在写完后关闭子进程输入。
   */
  readonly input?: string | undefined
}

/**
 * 原始子进程结果；信号终止时 exitCode 为 null。
 */
export interface CommandResult {
  /**
   * 正常结束时的退出码，信号终止时为 null。
   */
  readonly exitCode: number | null
  /**
   * 终止信号，正常退出时为 null。
   */
  readonly signal: NodeJS.Signals | null
  /**
   * 管道模式捕获的标准输出；inherit 模式为空。
   */
  readonly stdout: string
  /**
   * 管道模式捕获的标准错误；inherit 模式为空。
   */
  readonly stderr: string
  /**
   * 按接收到数据块的先后拼接两路输出，不保证还原跨流的写入顺序。
   */
  readonly output: string
}

/**
 * 公开原生命令执行能力。
 */
export interface TerminalCommands {
  /**
   * 执行命令，默认继承原生终端，不生成任务反馈。
   * @param options - 可执行文件、参数及单次环境和输出策略。
   * @example await terminal.executeCommand({ command: "node", args: ["--version"], outputMode: "capture" })
   */
  executeCommand(this: void, options: ExecuteCommandOptions): Promise<CommandResult>
}

/**
 * 描述单个实例持有的命令默认值、取消信号和日志边界。
 */
export interface CommandEnvironment {
  // 单次命令未提供目录时使用的实例目录。
  readonly cwd: string
  // 已合并工厂配置的默认环境。
  readonly env: NodeJS.ProcessEnv
  // dispose 或进程信号触发时中止本实例的子进程。
  readonly signal: AbortSignal
  // 只标记原生日志边界，不加工子进程数据。
  readonly renderer: Renderer
}

/**
 * 执行原生进程；采集结果从不作为是否已经展示的标记。
 * @param options - 命令与输出策略。
 * @param environment - 实例默认值和取消资源。
 * @example await executeProcess({ command: "node", args: ["--version"] }, environment)
 */
async function executeProcess(
  options: ExecuteCommandOptions,
  environment: CommandEnvironment
): Promise<CommandResult> {
  // 默认直接继承真实终端；管道模式只在明确要求时启用。
  const mode = options.outputMode ?? "inherit"

  if (mode !== "capture") {
    environment.renderer.beginNative()
  }

  // 原生 TTY 由子进程控制；托管日志和采集模式继续使用任务动画。
  const resumeLoading =
    mode === "inherit" ? environment.renderer.pauseLoading() : undefined

  try {
    return await new Promise<CommandResult>(
      /**
       * 将事件驱动的完成结果转换为可等待的 Promise。
       * @param resolve - 操作完成后结算当前等待。
       * @param reject - 将操作错误保留给调用方。
       */ (resolve, reject) => {
        // 采集和透传采集模式都需要读取子进程输出管道。
        const pipe = mode !== "inherit"

        // 参数逐项传递，避免 shell 解释命令和转义字符。
        const child = spawn(options.command, [...(options.args ?? [])], {
          cwd: options.cwd ?? environment.cwd,
          env: { ...environment.env, ...options.env },
          stdio: [
            options.input !== undefined || pipe ? "pipe" : "inherit",
            pipe ? "pipe" : "inherit",
            pipe ? "pipe" : "inherit",
          ],
          shell: false,
          signal: environment.signal,
        })

        // 两路输出独立保留，便于消费端解析 stdout。
        let stdout = ""

        // 诊断输出保留空白、颜色及重复行。
        let stderr = ""

        // 合并视图按父进程收到数据块的顺序追加。
        let output = ""

        // error 事件不直接结算，等待 close 确认流已关闭。
        let failure: Error | undefined

        child.stdout?.setEncoding("utf8")
        child.stderr?.setEncoding("utf8")
        /**
         * 采集标准输出，tee 模式同时逐块透传。
         * @param chunk - UTF-8 解码后的原始标准输出。
         */
        const onStdout = (chunk: string): void => {
          stdout += chunk
          output += chunk
          if (mode === "tee") {
            environment.renderer.writeNative(chunk, "stdout")
          }
        }

        /**
         * 采集标准错误，tee 模式保留其原有通道。
         * @param chunk - UTF-8 解码后的原始标准错误。
         */
        const onStderr = (chunk: string): void => {
          stderr += chunk
          output += chunk
          if (mode === "tee") {
            environment.renderer.writeNative(chunk, "stderr")
          }
        }

        /**
         * 保存启动或取消异常，保留原始异常身份。
         * @param error - spawn 报告的进程异常。
         */
        const onError = (error: Error): void => {
          failure = error
        }

        /**
         * 在进程和输出流关闭后结算，非零退出码仍作为结果返回。
         * @param exitCode - 正常退出码，信号终止时为 null。
         * @param signal - 终止信号，正常退出时为 null。
         */
        const onClose = (
          exitCode: number | null,
          signal: NodeJS.Signals | null
        ): void => {
          if (failure) {
            reject(failure)

            return
          }

          resolve({ exitCode, signal, stdout, stderr, output })
        }

        /**
         * 容忍命令提前关闭输入管道，其他输入错误仍向消费端报告。
         * @param error - stdin 管道的写入错误。
         */
        const onInputError = (error: NodeJS.ErrnoException): void => {
          if (error.code !== "EPIPE") {
            failure = error
          }
        }

        child.stdout?.on("data", onStdout)
        child.stderr?.on("data", onStderr)
        child.on("error", onError)
        child.on("close", onClose)
        child.stdin?.on("error", onInputError)
        child.stdin?.end(options.input)
      }
    )
  } finally {
    if (mode !== "capture") {
      environment.renderer.endNative(mode === "inherit")
    }

    resumeLoading?.()
  }
}

// 命令只注入开始校验和退出查询，不读取完整终端对象。
interface CommandsOptions extends CommandEnvironment {
  // 取消或释放后禁止启动命令。
  readonly checkExecution: () => void
  // 清理阶段由协调器统一退出，避免 AbortError 抢先传播。
  readonly getSignalExit: () => Promise<never> | undefined
}

/**
 * 独立执行能力及内部的原始进程等待操作。
 */
export interface Commands extends TerminalCommands {
  /**
   * 只等待原始进程关闭，不等待宿主退出屏障。
   */
  waitForIdle(this: void): Promise<void>
}

/**
 * 创建绑定默认环境、取消信号和进程记录的执行器。
 * @param environment - 命令默认配置、日志边界及必要会话操作。
 * @example const commands = createCommands({ cwd, env, signal, renderer, checkExecution, getSignalExit })
 */
export function createCommands(environment: CommandsOptions): Commands {
  // 只追踪原始进程 Promise，清理时不会等待宿主退出而死锁。
  const operations = new Set<Promise<CommandResult>>()

  // 实例状态每次使用时查询，不复制到命令模块。
  const { checkExecution, getSignalExit } = environment

  // 等待自有进程结束；信号阶段交由协调器清理并统一退出。
  const executeCommand: TerminalCommands["executeCommand"] = async (
    options: ExecuteCommandOptions
  ): Promise<CommandResult> => {
    checkExecution()
    // 原始进程 Promise 只等待进程关闭，不等待宿主退出。
    const operation = executeProcess(options, environment)

    operations.add(operation)
    try {
      // 保留执行器或业务回调的原始结果，不额外复制或解释业务值。
      const result = await operation

      // 保持原始进程关闭与宿主退出屏障的等待分离。
      const signalExit = getSignalExit()

      if (signalExit) {
        await signalExit
      }

      return result
    } catch (failure) {
      // 保持原始进程关闭与宿主退出屏障的等待分离。
      const signalExit = getSignalExit()

      if (signalExit) {
        await signalExit
      }

      throw failure
    } finally {
      operations.delete(operation)
    }
  }

  // allSettled 容忍被中止进程的原始异常，外部操作仍保留该异常。
  const waitForIdle = async (): Promise<void> => {
    await Promise.allSettled(operations)
  }

  return { executeCommand, waitForIdle }
}
