/**
 * 终端主题。
 *
 * @remarks 颜色只编码「结果」，层级完全交给缩进表达。
 *
 * 原实现给分组标题（蓝 `◆`）、说明（蓝 `●`）、进行中（绿 `◐`）、成功（绿 `◇`）
 * 分别上了不同符号与颜色，导致「我在第几层」和「结果是什么」两件事在同一条视觉通道里
 * 混用：蓝色既表示分组也表示说明，绿色既表示进行中也表示成功，而蓝绿两色在深色终端上
 * 明度接近、几乎无法分辨。这里把通道拆开——位置看缩进，结果看符号与颜色。
 *
 * 渲染使用 Node 内置的 `util.styleText`，不依赖任何外部二进制。
 */
import { styleText } from "node:util"

/** 主题色表。 */
const PALETTE = {
  /** 成功。 */
  success: "#4ade80",
  /** 失败。 */
  error: "#f87171",
  /** 取消。 */
  warning: "#fbbf24",
  /** 跳过与次要信息。 */
  muted: "#8b95a5",
  /** 导轨。 */
  rail: "#5b6472",
} as const

/** 转圈帧。使用 braille 系列，在深色终端上笔画最细、最不刺眼。 */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const

/** 转圈帧间隔。慢于 Clack 的 80ms，减少小屏上的闪烁与无效重绘。 */
export const SPINNER_INTERVAL_MS = 100

/** 结果符号。 */
const RESULT_SYMBOL = {
  /** 进行中；仅长驻服务在启动时出现。 */
  running: "▸",
  /** 成功。 */
  success: "✔",
  /** 失败。 */
  error: "✖",
  /** 取消。 */
  cancelled: "■",
  /** 跳过。 */
  skipped: "○",
  /** 未执行。 */
  pending: "○",
} as const

/** 结果类别。 */
export type Result = keyof typeof RESULT_SYMBOL

/** 主题色名。 */
export type ColorName = keyof typeof PALETTE

/** 判断颜色是否应当启用。 */
let colorEnabled = true

/**
 * 依据目标流与 NO_COLOR 决定是否输出 ANSI 序列。
 *
 * @param isTTY - 目标流是否为终端。
 */
export function setColorSupport(isTTY: boolean): void {
  colorEnabled = isTTY && process.env.NO_COLOR === undefined
}

/**
 * 构造一个着色函数。
 *
 * @param name - 主题色名。
 * @returns 着色函数。
 */
function painter(name: ColorName): (text: string) => string {
  return (text: string): string =>
    colorEnabled ? styleText(PALETTE[name], text, { validateStream: false }) : text
}

/**
 * 渲染主题。
 *
 * @remarks 分三个明暗层级：标题最重、正文居中、说明最轻。
 */
export const theme = {
  /** 层级标题：加粗 + 默认前景色。 */
  title: (text: string): string =>
    colorEnabled ? styleText("bold", text, { validateStream: false }) : text,
  /** 正文：终端默认前景色。 */
  text: (text: string): string => text,
  /** 次要说明：弱化色。 */
  dim: painter("muted"),
  /** 结果语义色。 */
  success: painter("success"),
  /** 失败语义色。 */
  error: painter("error"),
  /** 取消语义色。 */
  warning: painter("warning"),
  /** 跳过语义色。 */
  muted: painter("muted"),
  /** 导轨。 */
  rail: painter("rail"),
} as const

/**
 * 返回结果的着色符号。
 *
 * @param result - 结果类别。
 * @returns 带色符号。
 */
export function resultSymbol(result: Result): string {
  const symbol = RESULT_SYMBOL[result]

  switch (result) {
    case "running":
      return theme.dim(symbol)
    case "success":
      return theme.success(symbol)
    case "error":
      return theme.error(symbol)
    case "cancelled":
      return theme.warning(symbol)
    case "skipped":
    case "pending":
      return theme.muted(symbol)
  }
}

/**
 * 把时长渲染为紧凑文本。
 *
 * @param milliseconds - 毫秒数。
 * @returns 紧凑时长文本。
 */
export function formatDuration(milliseconds: number): string {
  return milliseconds < 1000
    ? `${Math.max(0, Math.round(milliseconds))}ms`
    : `${(milliseconds / 1000).toFixed(1)}s`
}

/**
 * 子进程输出中的命令回显。
 *
 * @remarks pnpm、yarn 与 npm 都会在输出里回显自己执行的命令。这些行是**上下文**而不是
 * 结论，若与错误一起染红，整块输出会失去可读性。
 */
const COMMAND_ECHO = /^\s*[$>]\s/

/**
 * 子进程输出中的错误结论。
 *
 * @remarks 只匹配明确的失败标记，避免把 `0 errors` 之类的普通行误判成错误。
 */
const ERROR_LINE =
  /(^|\s)(error TS\d+|- error\b|error:|Error:|ERROR:|ERR_[A-Z_]+|ELIFECYCLE|Command failed|[✗✖])/

/** 子进程输出中一行的语义类别。 */
export type DetailTone = "command" | "error" | "plain"

/**
 * 判断子进程输出中一行的语义类别。
 *
 * @param line - 输出行。
 * @returns 语义类别。
 */
export function classifyDetailLine(line: string): DetailTone {
  if (COMMAND_ECHO.test(line)) {
    return "command"
  }

  if (ERROR_LINE.test(line)) {
    return "error"
  }

  return "plain"
}

/** SGR 颜色序列。用字符码构造，避免正则中出现裸控制字符。 */
const ANSI_SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

/**
 * 计算文本的可见宽度，忽略 ANSI 颜色序列。
 *
 * @param text - 文本。
 * @returns 可见字符数。
 */
export function visibleWidth(text: string): number {
  return text.replace(ANSI_SGR, "").length
}

/**
 * 按可见宽度右补齐，保证含颜色的文本也能对齐成列。
 *
 * @param text - 文本。
 * @param width - 目标宽度。
 * @returns 补齐后的文本。
 */
export function padEnd(text: string, width: number): string {
  const visible = visibleWidth(text)

  return visible >= width ? text : text + " ".repeat(width - visible)
}

/**
 * 按可见宽度左补齐。
 *
 * @param text - 文本。
 * @param width - 目标宽度。
 * @returns 补齐后的文本。
 */
export function padStart(text: string, width: number): string {
  const visible = visibleWidth(text)

  return visible >= width ? text : " ".repeat(width - visible) + text
}
