/** 工作流文案、高亮和退出码适配；通用终端层不解释这些业务规则。 */
import { constants } from "node:os"

import { WorkflowError } from "./core/errors.ts"

import type { RunOptions, RunResult } from "./core/exec.ts"
import type {
  CommandResult,
  ExecuteCommandOptions,
  FlowId,
  ParentId,
  RunCommandOptions,
  RunTaskOptions,
  Terminal,
  TerminalRole,
} from "./ui/index.ts"

interface WorkflowTextOptions {
  readonly terminal: Terminal
  readonly content: string
}
/** 工作流关键词只在消费层识别。 */
const TOKEN =
  /`[^`\n]+`|--[a-zA-Z][\w-]*(?:=[\w./:@-]+)?|@[\w.-]+\/[\w.-]+(?:@[\w.+-]+)?|(?:packages|examples|plugins|scripts)\/[\w./@-]+|\b(?:pnpm|npm|node|git|gh)\b|\bv?\d+\.\d+\.\d+(?:-[\w.-]+)?\b|\b\d+(?:\.\d+)?(?:ms|s)?\b/g

/**
 * 保留当前工作流的关键词配色。
 * @param options - 终端与工作流文本。
 * @example formatWorkflowText({ terminal, content: "pnpm build core" })
 */
export function formatWorkflowText({ terminal, content }: WorkflowTextOptions): string {
  if (content.includes(String.fromCharCode(27))) {
    return content
  }

  return content
    .split("\n")
    .map((line) => {
      const field = line.match(/^(\s*[^：]+：)(.+)$/)

      if (field) {
        return (
          terminal.formatText({ content: field[1] ?? "", role: "muted" }) +
          terminal.formatText({ content: field[2] ?? "", role: "value" })
        )
      }

      return line.replace(TOKEN, (token) => {
        let role: TerminalRole = "command"

        if (token.startsWith("@")) {
          role = "target"
        } else if (/^v?\d/.test(token)) {
          role = "value"
        }

        return terminal.formatText({ content: token, role })
      })
    })
    .join("\n")
}
/**
 * 将通用命令结果转换为工作流的数字退出码。
 * @param result - 原始命令结果。
 * @example commandExitCode({ exitCode: 0, signal: null, stdout: "", stderr: "", output: "" })
 */
export function commandExitCode(result: CommandResult): number {
  return result.exitCode ?? (result.signal ? 128 + constants.signals[result.signal] : 1)
}
/**
 * 将异常转换为工作流退出码；终端已经记录任务失败，不重复打印。
 * @param error - 原始异常。
 * @example workflowExitCode(new Error("failed"))
 */
export function workflowExitCode(error: unknown): number {
  if (error instanceof WorkflowError) {
    return error.exitCode
  }

  return error instanceof Error && error.name === "AbortError" ? 130 : 1
}

interface WorkflowTaskOptions extends RunTaskOptions<unknown> {
  readonly terminal: Terminal
}

/**
 * 保留旧业务分支按退出码继续执行的策略，异常契约不放入通用终端。
 * @param options - 任务与终端。
 * @example runWorkflowTask({ terminal, title: "检查", execute: async () => {} })
 */
export async function runWorkflowTask({
  terminal,
  ...options
}: WorkflowTaskOptions): Promise<number> {
  try {
    await terminal.runTask(options)

    return 0
  } catch (error) {
    return workflowExitCode(error)
  }
}

interface WorkflowCommandOptions extends RunCommandOptions {
  readonly terminal: Terminal
}

/**
 * 执行带反馈的命令并返回 CLI 退出码。
 * @param options - 命令与终端。
 * @example runWorkflowCommand({ terminal, title: "构建", command: "pnpm", args: ["build"] })
 */
export async function runWorkflowCommand({
  terminal,
  ...options
}: WorkflowCommandOptions): Promise<number> {
  try {
    return commandExitCode(await terminal.runCommand(options))
  } catch (error) {
    return workflowExitCode(error)
  }
}

interface WorkflowExecuteOptions extends ExecuteCommandOptions {
  readonly terminal: Terminal
}

/**
 * 适配仍消费数字 code 的 Git/npm 边界，不清空采集结果。
 * @param options - 无额外任务反馈的命令。
 * @example executeWorkflowCommand({ terminal, command: "git", args: ["status"] })
 */
export async function executeWorkflowCommand({
  terminal,
  ...options
}: WorkflowExecuteOptions): Promise<RunResult> {
  const result = await terminal.executeCommand(options)

  return {
    code: commandExitCode(result),
    stdout: result.stdout,
    stderr: result.stderr,
    output: result.output,
  }
}

interface WorkflowRunnerOptions {
  readonly terminal: Terminal
  readonly title?: string
  readonly target?: string
  readonly parentId?: ParentId | undefined
}

/**
 * 将发布适配器的执行依赖绑定到终端。
 * @param options - 终端及可选任务反馈元数据。
 * @example const execute = workflowRunner({ terminal, title: "发布" })
 */
export function workflowRunner(
  options: WorkflowRunnerOptions
): (
  command: string,
  args: readonly string[],
  runOptions?: RunOptions
) => Promise<RunResult> {
  const execute = async (
    command: string,
    args: readonly string[],
    runOptions: RunOptions = {}
  ): Promise<RunResult> => {
    const request = {
      command,
      args,
      cwd: runOptions.cwd,
      env: runOptions.env,
      input: runOptions.input,
      // 发布写操作使用真实终端，机器数据采集由消费端显式选择 tee。
      outputMode: "inherit" as const,
    }

    if (options.title !== undefined) {
      const result = await options.terminal.runCommand({
        ...request,
        title: options.title,
        ...(options.target === undefined ? {} : { target: options.target }),
        parentId: options.parentId,
      })

      return {
        code: commandExitCode(result),
        stdout: result.stdout,
        stderr: result.stderr,
        output: result.output,
      }
    }

    return await executeWorkflowCommand({ terminal: options.terminal, ...request })
  }

  return execute
}

interface EndWorkflowFlowOptions {
  readonly terminal: Terminal
  readonly flowId: FlowId
  readonly exitCode: number
  readonly messages: Readonly<Record<"success" | "failed" | "cancelled", string>>
}

/**
 * 在业务边界选择结束文案。
 * @param options - 流程、退出码和业务文案。
 * @example endWorkflowFlow({ terminal, flowId, exitCode: 0, messages })
 */
export function endWorkflowFlow(options: EndWorkflowFlowOptions): void {
  let outcome: "success" | "failed" | "cancelled" = "failed"

  if (options.exitCode === 0) {
    outcome = "success"
  } else if (options.exitCode === 130) {
    outcome = "cancelled"
  }

  options.terminal.endFlow({
    flowId: options.flowId,
    outcome,
    message: options.messages[outcome],
  })
}

interface RequireWorkflowSuccessOptions {
  readonly result: RunResult
  readonly message: string
}

/**
 * 在工作流适配层解释业务命令退出码，通用 runTask 只按异常判断失败。
 * @param options - 结果和失败时的说明。
 * @example requireWorkflowSuccess({ result, message: "打包失败" })
 */
export function requireWorkflowSuccess({
  result,
  message,
}: RequireWorkflowSuccessOptions): void {
  if (result.code === 130) {
    throw new DOMException("操作已取消。", "AbortError")
  }

  if (result.code !== 0) {
    throw new WorkflowError(result.output || message, result.code)
  }
}
