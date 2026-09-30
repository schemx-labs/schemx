/**
 * 终端主题。
 *
 * @remarks 导轨与缩进表达层级，强调色标出阶段，语义色区分结果。
 * 使用终端色表，随用户的浅色或深色主题调整。
 *
 * 渲染使用 Node 内置的 `util.styleText`，不依赖任何外部二进制。
 */
import { styleText } from "node:util"

/** 主题色表。 */
const PALETTE = {
  /** 阶段标题与进行中。 */
  accent: "cyan",
  /** 成功。 */
  success: "green",
  /** 失败。 */
  error: "red",
  /** 取消。 */
  warning: "yellow",
  /** 跳过与次要信息。 */
  muted: "gray",
  /** 导轨。 */
  rail: "gray",
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
 * @param env - 用于读取 NO_COLOR 的环境变量。
 */
export function setColorSupport(
  isTTY: boolean,
  env: NodeJS.ProcessEnv = process.env
): void {
  colorEnabled = isTTY && env.NO_COLOR === undefined
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
  /** 阶段强调色。 */
  accent: painter("accent"),
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
  rail: (text: string): string =>
    colorEnabled
      ? styleText([PALETTE.rail, "dim"], text, { validateStream: false })
      : text,
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
      return theme.accent(symbol)
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

/** 将颜色序列与可见文字分开，换行时不会切断转义序列。 */
const ANSI_PARTS = new RegExp(`(${ANSI_SGR.source})`)

/** 按字素计算宽度，避免切开组合字符。 */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** 汉字、全角字符和默认以图形呈现的 emoji 占两个终端列。 */
const WIDE_CHARACTER =
  /[\u1100-\u115f\u2329\u232a\u2e80-\u303e\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u

/**
 * 计算文本的可见宽度，忽略 ANSI 颜色序列。
 *
 * @param text - 文本。
 * @returns 占用的终端列数。
 */
export function visibleWidth(text: string): number {
  let width = 0

  for (const { segment } of GRAPHEMES.segment(text.replace(ANSI_SGR, ""))) {
    width += WIDE_CHARACTER.test(segment) ? 2 : 1
  }

  return width
}

/**
 * 按终端列宽换行，保留显式换行、组合字符与 ANSI 颜色。
 *
 * @param text - 待换行文本。
 * @param width - 每行最多占用的终端列数。
 * @returns 换行后的文本行。
 * @example wrapText("发布前检查", 6) // ["发布前", "检查"]
 */
export function wrapText(text: string, width: number): readonly string[] {
  const lines: string[] = []

  for (const paragraph of text.split("\n")) {
    let line = ""

    let lineWidth = 0

    let styles = ""

    for (const part of paragraph.split(ANSI_PARTS)) {
      if (part.startsWith("\u001B[")) {
        line += part
        styles += part

        continue
      }

      for (const { segment } of GRAPHEMES.segment(part)) {
        const segmentWidth = visibleWidth(segment)

        if (lineWidth > 0 && lineWidth + segmentWidth > Math.max(1, width)) {
          lines.push(styles === "" ? line : `${line}\u001B[0m`)
          line = styles
          lineWidth = 0
        }

        line += segment
        lineWidth += segmentWidth
      }
    }

    lines.push(line)
  }

  return lines
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
