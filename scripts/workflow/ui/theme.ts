// 实例语义色与文字样式，不依赖布局或任务状态。
import { styleText } from "node:util"

/**
 * 终端语义色角色。
 */
export type TerminalRole =
  | "text"
  | "heading"
  | "accent"
  | "command"
  | "target"
  | "value"
  | "muted"
  | "success"
  | "error"
  | "warning"
  | "rail"

/**
 * 支持终端色表及默认前景色。
 */
export type TerminalColor =
  | "default"
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright"

/**
 * 每个角色使用的终端色。
 */
export type TerminalTheme = Readonly<Record<TerminalRole, TerminalColor>>

/**
 * 默认配色沿用当前工作流视觉。
 */
export const UI_COLOR = {
  text: "default",
  heading: "blueBright",
  accent: "magenta",
  command: "blueBright",
  target: "magentaBright",
  value: "blueBright",
  muted: "gray",
  success: "green",
  error: "red",
  warning: "yellow",
  // 使用灰色保持浅色背景上的对比度，white 在部分浅色终端中接近背景。
  rail: "gray",
} as const satisfies TerminalTheme

/**
 * 各语义角色额外使用的文字属性，颜色仍由 UI_COLOR 或实例主题提供。
 */
export const UI_TEXT_STYLE: Readonly<
  Partial<Record<TerminalRole, readonly ("bold" | "dim")[]>>
> = {
  heading: ["bold"],
  rail: ["dim"],
} as const

/**
 * 普通消息的语气到样式角色映射。
 */
export const UI_MESSAGE_ROLE = {
  neutral: "text",
  info: "accent",
  success: "success",
  error: "error",
  warning: "warning",
} as const satisfies Record<string, TerminalRole>

/**
 * 流程和任务的结束状态到样式角色映射。
 */
export const UI_OUTCOME_ROLE = {
  success: "success",
  failed: "error",
  cancelled: "warning",
} as const satisfies Record<string, TerminalRole>

/**
 * 摘要标题的缺省和中性样式，与普通中性消息分开维护。
 */
export const UI_SUMMARY_ROLE = {
  DEFAULT: "accent",
  NEUTRAL: "accent",
} as const satisfies Record<string, TerminalRole>

/**
 * 内部主题创建参数。
 */
interface ThemeOptions {
  // 是否允许生成 ANSI 属性，通常由输出 TTY 与 NO_COLOR 决定。
  readonly enabled: boolean
  // 只覆盖本实例的角色色，不修改默认主题。
  readonly theme?: Partial<TerminalTheme> | undefined
}

/**
 * 纯粹地格式化语义文字，不执行终端写入。
 * @param content - 已准备好的原始文字。
 * @param role - 当前主题中的语义角色。
 */
export type Formatter = (content: string, role: TerminalRole) => string
/**
 * 创建实例内的纯格式化函数。
 * @param options - 颜色开关和角色覆盖。
 * @example createTheme({ enabled: false })("build", "command")
 */
export function createTheme(options: ThemeOptions): Formatter {
  // 合并结果仅属于本实例。
  const palette = { ...UI_COLOR, ...options.theme }

  // 颜色策略在实例创建时固定，标题额外使用粗体。
  const format: Formatter = (content, role) => {
    // 角色对应的终端色，不识别正文中的业务词汇。
    const color: TerminalColor = palette[role]

    if (!options.enabled) {
      return content
    }

    // 保持颜色在前、文字属性在后的 ANSI 嵌套顺序。
    const styles = [
      ...(color === "default" ? [] : [color]),
      ...(UI_TEXT_STYLE[role] ?? []),
    ]

    return styles.length === 0
      ? content
      : styleText(styles, content, { validateStream: false })
  }

  return format
}
