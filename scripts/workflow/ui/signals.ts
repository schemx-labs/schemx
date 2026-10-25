import type { TerminalSignal } from "./session.ts"
import type { Key } from "node:readline"
import type { Readable } from "node:stream"
// 进程级信号协调，仅在第一个启用实例订阅时安装监听。

/**
 * 将实例自己的取消、清理和展示阶段接入进程信号协调器。
 */
export interface SignalParticipant {
  /**
   * 标记取消并停止本实例的交互和子进程。
   * @param event - 所有参与实例共享的本轮信号。
   */
  begin(event: TerminalSignal): void
  /**
   * 等待命令关闭并释放消费端注册的外部资源。
   * @param event - 触发本轮清理的信号和退出码。
   */
  clean(event: TerminalSignal): Promise<void>
  /**
   * 在所有清理完成后输出最终取消反馈。
   * @param event - 本轮结束时使用的信号和退出码。
   */
  finish(event: TerminalSignal): void
  /**
   * 等待已排队的最终反馈写入，协调器随后统一退出进程。
   */
  flush(): Promise<void>
}

// 仅系统监听资源跨实例共享，任务和展示状态仍由各实例持有。
const participants = new Set<SignalParticipant>()

// 清理期间忽略重复信号，防止第二轮退出打断异步清理。
let processing = false

/**
 * 等待全部实例清理后，只退出一次。
 * @param signal - 收到的系统信号。
 */
async function handleSignal(signal: "SIGINT" | "SIGTERM"): Promise<void> {
  if (processing) {
    return
  }

  processing = true
  // 保留 CLI 通常使用的 128 + 信号号退出约定。
  const event: TerminalSignal = { signal, exitCode: signal === "SIGINT" ? 130 : 143 }

  // 本轮使用快照，清理回调注销实例时不影响剩余阶段。
  const active = [...participants]

  // 未完成的 Promise 不会保持进程存活，清理期间显式维持事件循环。
  const keepAlive = setInterval(() => {}, 1000)

  try {
    // 先同步取消所有实例，再开始等待任意一个实例的清理。
    for (const participant of active) {
      participant.begin(event)
    }

    // 清理按实例注册顺序执行，保持输出和外部资源收尾顺序。
    for (const participant of active) {
      await participant.clean(event)
    }

    // 只有全部清理结束后才显示最终取消状态。
    for (const participant of active) {
      participant.finish(event)
    }

    await Promise.allSettled(
      active.map(
        /**
         * 等待最终输出写完，单个实例失败不跳过其他实例。
         * @param participant - 本轮信号快照中的终端参与者。
         */
        (participant) => participant.flush()
      )
    )
  } finally {
    clearInterval(keepAlive)
    process.exit(event.exitCode)
  }
}

/**
 * 将系统信号或原始输入中的 Ctrl+C 交给同一个协调器。
 * @param signal - 要处理的进程信号。
 * @example dispatchSignal("SIGINT")
 */
export function dispatchSignal(signal: "SIGINT" | "SIGTERM"): void {
  void handleSignal(signal)
}

// OS 信号回调复用同一分发器，raw mode 的 Ctrl+C 也走这条路径。
const onInterrupt = (): void => dispatchSignal("SIGINT")

// SIGTERM 使用独立函数引用，以便最后一个实例注销时移除监听。
const onTerminate = (): void => dispatchSignal("SIGTERM")

// 同时管理单个实例的输入监听和共享进程信号订阅。
interface SubscribeSignalsOptions {
  // 工厂显式决定是否启用，默认值策略不放入系统适配器。
  readonly enabled: boolean
  // raw mode 的 Ctrl+C 可能表现为按键而非 OS 信号。
  readonly input: Readable
  // 组合入口连接的实例阶段操作。
  readonly participant: SignalParticipant
}

/**
 * 绑定实例输入与系统信号，返回幂等注销操作。
 * @param options - 启用开关、实例输入和各阶段操作。
 * @example const unsubscribe = subscribeSignals({ enabled: true, input: process.stdin, participant })
 */
export function subscribeSignals(options: SubscribeSignalsOptions): () => void {
  // 未启用时不安装任何进程或输入监听。
  const noop = (): void => {}

  if (!options.enabled) {
    return noop
  }

  // 资源归属按实例划分，进程级监听仅在首个实例时安装。
  const { input, participant } = options

  /**
   * 将原始模式按键交给相同的系统信号协调器。
   * @param _text - readline 原始文字，本处理器只检查按键。
   * @param key - 用于识别 Ctrl+C 的可选按键描述。
   */
  const onKeypress = (_text: string, key?: Key): void => {
    if (key?.ctrl === true && key.name === "c") {
      dispatchSignal("SIGINT")
    }
  }

  input.on("keypress", onKeypress)
  if (participants.size === 0) {
    process.on("SIGINT", onInterrupt)
    process.on("SIGTERM", onTerminate)
  }

  participants.add(participant)
  // 重复注销不影响其他实例，最后一个实例才移除系统监听。
  const unsubscribe = (): void => {
    input.off("keypress", onKeypress)
    participants.delete(participant)
    if (participants.size === 0 && !processing) {
      process.off("SIGINT", onInterrupt)
      process.off("SIGTERM", onTerminate)
    }
  }

  return unsubscribe
}
