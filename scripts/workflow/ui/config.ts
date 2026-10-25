// 工作流自身 UI 的只读默认值，不参与子进程原生日志处理。

/**
 * 按展示语义选择标记，相同字形仍保留独立含义。
 */
export const UI_ICON = {
  INFO: "ℹ",
  SUCCESS: "✔",
  ERROR: "✗",
  WARNING: "⚠",
  CANCELLED: "↶",
  STARTED: "➤",
  GROUP: "◆",
  SKIPPED: "◎",
  PENDING: "○",
  LIST: "•",
} as const

/**
 * 导轨的 LINE 须保持单列，以兼容交互控件的重绘坐标。
 */
export const UI_RAIL = {
  LINE: "│",
  START: "╭─",
  END: "╰─",
  BRANCH: "├─",
} as const

/**
 * 任务状态文案，与图标和运行时状态标识分开维护。
 */
export const UI_TASK_TEXT = {
  STARTED: "开始",
  SUCCESS: "完成",
  FAILED: "失败",
  CANCELLED: "已取消",
  CLEANING_UP: "正在取消，等待清理…",
} as const

/**
 * 异常无法直接展示时使用的兜底文案。
 */
export const UI_ERROR_TEXT = {
  UNKNOWN: "未知错误。",
  UNPRINTABLE: "无法显示的错误对象。",
} as const

/**
 * 交互环境和输入取消的通用提示，不修改 AbortError 等异常标识。
 */
export const UI_PROMPT_TEXT = {
  UNSUPPORTED: "当前环境不支持交互，请显式提供参数。",
  ALREADY_ACTIVE: "同一终端不能同时显示多个交互控件。",
  SELECTION_CANCELLED: "已取消选择。",
  INPUT_CANCELLED: "已取消输入。",
  CONFIRMATION_CANCELLED: "已取消确认。",
} as const

/**
 * 结构化展示片段之间的分隔符。
 */
export const UI_SEPARATOR = {
  PART: " · ",
  FIELD: "：",
} as const

/**
 * 留白和正文缩进；实际前缀占用列宽由渲染器计算。
 */
export const UI_LAYOUT = {
  FALLBACK_COLUMNS: 80,
  BODY_INDENT_COLUMNS: 2,
  TASK_GAP_LINES: 1,
  STAGE_GAP_LINES: 2,
  SUMMARY_GAP_LINES: 1,
} as const

/**
 * 延迟出现的单行 loading，帧数组按播放顺序排列且至少保留一帧。
 */
export const UI_LOADING = {
  DELAY_MS: 150,
  INTERVAL_MS: 80,
  FRAMES: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
} as const

/**
 * 耗时的展示精度和单位；单位换算仍由计时逻辑负责。
 */
export const UI_DURATION = {
  SECONDS_FRACTION_DIGITS: 1,
  MILLISECONDS_UNIT: "ms",
  SECONDS_UNIT: "s",
} as const

/**
 * 所有交互控件共用的导轨外观，不包含允许空选等业务约束。
 */
export const UI_PROMPT_APPEARANCE = {
  WITH_GUIDE: true,
} as const
