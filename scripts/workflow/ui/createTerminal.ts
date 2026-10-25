// 公共工厂只负责创建、连接和组合各模块，不实现任务或进程状态机。
import { createCommands } from "./commands.ts"
import { createMessages } from "./messages.ts"
import { createPrompts } from "./prompts/createPrompts.ts"
import { createRenderer } from "./renderer.ts"
import { createScopeState } from "./scope-state.ts"
import { createScopes } from "./scopes.ts"
import { createSession } from "./session.ts"
import { subscribeSignals } from "./signals.ts"
import { createTasks } from "./tasks.ts"
import { createTheme } from "./theme.ts"

import type { TerminalOutput } from "./renderer.ts"
import type { TerminalSignal } from "./session.ts"
import type { Terminal, TerminalOptions } from "./types.ts"
import type { Readable } from "node:stream"

// 普通可读流不提供 TTY 标记时，按非交互输入处理。
interface TerminalInput extends Readable {
  // 只读取输入真实能力，不伪造 TTY。
  readonly isTTY?: boolean
}

/**
 * 创建完整终端，各操作使用同一实例的资源和状态。
 * @param options - 输入输出、默认命令环境、主题及信号接管配置。
 * @returns 可解构调用的扁平终端能力。
 * @example const terminal = createTerminal({ handleSignals: false })
 */
export function createTerminal(options: TerminalOptions = {}): Terminal {
  // 借用宿主输入输出流，实例释放不关闭这些资源。
  const input: TerminalInput = options.input ?? process.stdin

  // 工作流反馈默认写 stderr，不污染机器可读 stdout。
  const output: TerminalOutput = options.output ?? process.stderr

  // 每个实例使用环境副本，单次命令还可覆盖。
  const env = { ...process.env, ...options.env }

  // 默认目录固定于创建时。
  const cwd = options.cwd ?? process.cwd()

  // 交互能力由输入、输出和 CI 环境共同确定。
  const isInteractive = input.isTTY === true && output.isTTY === true && env.CI !== "true"

  // 会话先创建，后续模块只接收必要的状态查询或取消资源。
  const session = createSession()

  // 颜色规则与 NO_COLOR 保持现有行为。
  const format = createTheme({
    enabled: output.isTTY === true && env.NO_COLOR === undefined,
    theme: options.theme,
  })

  // 所有展示共用唯一主线渲染器。
  const renderer = createRenderer({ output, env, format })

  // 登记状态先于消息创建，消除消息与范围反馈的初始化循环。
  const state = createScopeState({
    check: session.check,
    checkExecution: session.checkExecution,
  })

  // 消息只通过范围状态校验父级，不依赖范围反馈模块。
  const messages = createMessages({ format, renderer, checkParent: state.checkParent })

  // 范围反馈调用消息能力，登记及实例状态各由所属模块维护。
  const scopes = createScopes({
    format,
    renderer,
    state,
    check: session.check,
    text: messages.text,
    reportError: messages.reportError,
    isCancelled: session.getCancelled,
    isHandlingSignal: session.isHandlingSignal,
    isFinalizing: session.isFinalizing,
  })

  // 命令模块持有进程集合，工厂不跟踪 Promise 或处理进程异常。
  const commands = createCommands({
    cwd,
    env,
    signal: session.signal,
    renderer,
    checkExecution: session.checkExecution,
    getSignalExit: session.getSignalExit,
  })

  // 任意操作及命令的反馈组合由任务模块负责。
  const tasks = createTasks({
    startTask: scopes.startTask,
    succeedTask: scopes.succeedTask,
    failTask: scopes.failTask,
    cancelTask: scopes.cancelTask,
    executeCommand: commands.executeCommand,
    isDisposed: session.isDisposed,
    getSignalExit: session.getSignalExit,
  })

  // 交互模块自行创建并释放输出适配流。
  const prompts = createPrompts({
    input,
    output,
    format,
    renderer,
    signal: session.signal,
    interactive: isInteractive,
    check: session.checkExecution,
    signalExit: session.getSignalExit,
  })

  /**
   * 只协调清理阶段顺序，具体进程等待和外部清理由所属模块实现。
   * @param event - 进程级协调器分发的本轮信号。
   */
  const cleanSignal = async (event: TerminalSignal): Promise<void> => {
    await commands.waitForIdle()
    renderer.beginCleanup()
    await session.cleanSignal({ event, reportError: messages.reportError })
  }

  // 清理完成后允许范围结束，再执行先前提出的延迟释放。
  const finishSignal = (): void => {
    session.beginFinalizing()
    scopes.finishSignal()
    renderer.setLoading()
    session.finishDisposal()
  }

  // 所有模块创建完毕才绑定信号，默认启用规则保持不变。
  const unsubscribeSignals = subscribeSignals({
    enabled: options.handleSignals !== false,
    input,
    participant: {
      begin: session.beginSignal,
      clean: cleanSignal,
      finish: finishSignal,
      flush: renderer.flush,
    },
  })

  // 释放每个模块自己的资源，状态及幂等性由 session 管理。
  const releaseResources = (): void => {
    prompts.dispose()
    renderer.dispose()
    scopes.dispose()
    state.dispose()
  }

  // 会话决定立即释放或延迟释放，工厂只提供已绑定的资源操作。
  const dispose: Terminal["dispose"] = () =>
    session.dispose({ unsubscribe: unsubscribeSignals, release: releaseResources })

  // 只列出公共成员，内部等待、登记和清理操作不会泄漏到消费端。
  const terminal: Terminal = {
    isInteractive,
    isCancelled: false,
    formatText: messages.formatText,
    heading: messages.heading,
    text: messages.text,
    status: messages.status,
    info: messages.info,
    success: messages.success,
    warning: messages.warning,
    error: messages.error,
    fields: messages.fields,
    list: messages.list,
    code: messages.code,
    summary: messages.summary,
    startFlow: scopes.startFlow,
    endFlow: scopes.endFlow,
    startGroup: scopes.startGroup,
    endGroup: scopes.endGroup,
    startTask: scopes.startTask,
    succeedTask: scopes.succeedTask,
    failTask: scopes.failTask,
    cancelTask: scopes.cancelTask,
    skipTask: scopes.skipTask,
    pendingTask: scopes.pendingTask,
    executeCommand: commands.executeCommand,
    runCommand: tasks.runCommand,
    runTask: tasks.runTask,
    select: prompts.select,
    multiselect: prompts.multiselect,
    groupMultiselect: prompts.groupMultiselect,
    input: prompts.input,
    confirm: prompts.confirm,
    onSignal: session.onSignal,
    dispose,
  }

  Object.defineProperty(terminal, "isCancelled", { get: session.getCancelled })

  return terminal
}
