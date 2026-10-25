// 公共终端总契约，不持有实现状态。
import type { TerminalCommands } from "./commands.ts"
import type { TerminalMessages } from "./messages.ts"
import type { TerminalPrompts } from "./prompts/createPrompts.ts"
import type { TerminalScopes } from "./scopes.ts"
import type { TerminalSession } from "./session.ts"
import type { TerminalTasks } from "./tasks.ts"
import type { TerminalTheme } from "./theme.ts"
import type { Readable, Writable } from "node:stream"

/**
 * 工厂环境与资源配置。
 */
export interface TerminalOptions {
  /**
   * 交互输入，默认 process.stdin。
   */
  readonly input?: Readable
  /**
   * 反馈和交互输出，默认 process.stderr；原生命令按 outputMode 处理。
   */
  readonly output?: Writable
  /**
   * 合并到当前进程环境，作为实例和命令的默认环境。
   */
  readonly env?: NodeJS.ProcessEnv
  /**
   * 命令默认目录，默认当前工作目录。
   */
  readonly cwd?: string
  /**
   * 只覆盖本实例的语义色。
   */
  readonly theme?: Partial<TerminalTheme>
  /**
   * 默认 true；清理监听回调完成后统一退出。
   */
  readonly handleSignals?: boolean
}

/**
 * 汇总各模块的公开能力；方法均可解构调用。
 */
export interface Terminal
  extends
    TerminalMessages,
    TerminalScopes,
    TerminalCommands,
    TerminalTasks,
    TerminalPrompts,
    TerminalSession {
  /**
   * 实例创建时判断的交互能力，同时检查输入、输出和 CI 环境。
   */
  readonly isInteractive: boolean
}
