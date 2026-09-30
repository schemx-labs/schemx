/**
 * 子进程执行。统一 spawn 行为、退出码语义与取消传播。
 */
import { spawn } from "node:child_process"

/** 一次子进程执行的结果。 */
export interface RunResult {
  /** 退出码；被信号终止时取 128 + 信号号。 */
  readonly code: number
  /** 捕获模式下的标准输出。 */
  readonly stdout: string
  /** 捕获模式下的标准错误。 */
  readonly stderr: string
  /**
   * 捕获模式下的合并输出。
   *
   * @remarks 工具的错误结论与警告常分处两个流：pnpm 把 `error TS…` 写 stdout、把版本
   * 不兼容警告写 stderr。只取其一会整块丢掉真正要看的结论，因此保留合并视图。
   */
  readonly output: string
}

/** 实时输出回调；携带来源流，供渲染层独立缓冲半行。 */
export type OutputHandler = (chunk: string, stream: "stdout" | "stderr") => void

/** 子进程执行选项。 */
export interface RunOptions {
  /** 工作目录，默认继承当前进程。 */
  cwd?: string
  /** 附加的环境变量；与当前环境合并。 */
  env?: NodeJS.ProcessEnv
  /** 捕获标准输出；默认捕获，设为 false 时使用实时输出。 */
  capture?: boolean
  /** 标准输入内容。 */
  input?: string
  /** 透传模式下接收输出；提供时由调用方渲染实时日志。 */
  onOutput?: OutputHandler
}

/**
 * 运行一个子进程并等待结束。
 *
 * @remarks 子进程与当前进程同属前台进程组，Ctrl+C 会同时送达两端；
 * 当前进程由取消控制器负责收尾，子进程由终端信号直接终止。
 *
 * @param command - 可执行文件。
 * @param args - 命令参数。
 * @param options - 执行选项。
 * @returns 执行结果。
 */
export async function run(
  command: string,
  args: readonly string[],
  options: RunOptions = {}
): Promise<RunResult> {
  const capture = options.capture ?? true

  const pipeOutput = capture || options.onOutput !== undefined

  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      stdio: pipeOutput ? ["pipe", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
      shell: false,
    })

    let stdout = ""

    let stderr = ""

    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      if (capture) {
        stdout += chunk
      } else {
        options.onOutput?.(chunk, "stdout")
      }
    })
    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => {
      if (capture) {
        stderr += chunk
      } else {
        options.onOutput?.(chunk, "stderr")
      }
    })

    child.on("error", reject)
    child.on("close", (code, signal) => {
      const merged = [stdout, stderr]
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .join("\n")

      resolve({ code: code ?? (signal ? 128 : 1), stdout, stderr, output: merged })
    })

    if (options.input !== undefined && child.stdin) {
      child.stdin.end(options.input)
    } else {
      child.stdin?.end()
    }
  })
}

/**
 * 运行子进程并在失败时抛出错误。
 *
 * @param command - 可执行文件。
 * @param args - 命令参数。
 * @param options - 执行选项。
 * @returns 标准输出内容。
 * @throws {Error} 退出码非 0 时抛出。
 */
export async function runOrThrow(
  command: string,
  args: readonly string[],
  options: RunOptions = {}
): Promise<string> {
  const result = await run(command, args, { ...options, capture: true })

  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim()

    throw new Error(
      `命令失败（exit ${result.code}）：${command} ${args.join(" ")}${detail ? `\n${detail}` : ""}`
    )
  }

  return result.stdout
}
