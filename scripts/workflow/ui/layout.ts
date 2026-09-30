/**
 * 输出布局。
 *
 * @remarks 与渲染分离，使列宽计算与任务行排版可以脱离终端独立测试。
 */
import {
  formatDuration,
  padEnd,
  padStart,
  resultSymbol,
  theme,
  visibleWidth,
} from "./theme.ts"

import type { Result } from "./theme.ts"

/** 任务结果。 */
export type TaskStatus = Result | "running"

/** 批处理列布局。 */
export interface ColumnLayout {
  /** 目标列宽度。 */
  readonly target: number
  /** 任务名列宽度。 */
  readonly label: number
  /** 耗时列宽度。 */
  readonly duration: number
}

/** 一条任务行的内容。 */
export interface TaskRow {
  /** 结果类别。 */
  readonly status: TaskStatus
  /** 目标标识，例如 npm 包名。 */
  readonly target?: string | undefined
  /** 任务名称。 */
  readonly label: string
  /** 耗时毫秒数；未执行时省略。 */
  readonly duration?: number | undefined
  /** 未执行时的占位原因。 */
  readonly pendingReason?: string | undefined
  /** 是否为列表中的最后一项；省略时不画树形连接符。 */
  readonly last?: boolean | undefined
  /** 覆盖结果符号；用于用转圈帧占据符号位，避免与状态符号叠印。 */
  readonly frame?: string | undefined
}

/** 树形连接符。 */
const TREE_BRANCH = "├─"

/** 树形末项连接符。 */
const TREE_LAST = "└─"

/** 列宽上限，避免超长包名把耗时列挤出屏幕。 */
const MAX_TARGET_WIDTH = 32

/** 任务名列宽上限。 */
const MAX_LABEL_WIDTH = 24

/**
 * 为流程内容提供连续的左侧导轨。
 *
 * @param depth - 导轨之后的缩进层级。
 * @returns 导轨与缩进前缀。
 * @example railPrefix(1) + "检查结果"
 */
export function railPrefix(depth = 0): string {
  return `${theme.rail("│")}  ${"  ".repeat(Math.max(0, depth))}`
}

/**
 * 计算批处理所需的列宽。
 *
 * @remarks 宽度取实际内容与最小宽度的较大值，避免包名长短差异造成列错位。
 *
 * @param targets - 全部目标标识。
 * @param labels - 全部任务名称。
 * @returns 列布局。
 */
export function computeColumns(
  targets: readonly string[],
  labels: readonly string[]
): ColumnLayout {
  const widestTarget = targets.reduce((max, item) => Math.max(max, visibleWidth(item)), 0)

  const widestLabel = labels.reduce((max, item) => Math.max(max, visibleWidth(item)), 0)

  return {
    target: Math.min(Math.max(widestTarget, 12), MAX_TARGET_WIDTH),
    label: Math.min(Math.max(widestLabel, 10), MAX_LABEL_WIDTH),
    duration: 7,
  }
}

/**
 * 渲染耗时或未执行原因。
 *
 * @param row - 任务行内容。
 * @returns 右对齐的尾部文本。
 */
function renderDuration(row: TaskRow): string {
  if (row.pendingReason !== undefined) {
    return theme.dim(row.pendingReason)
  }

  if (row.duration !== undefined) {
    return theme.dim(formatDuration(row.duration))
  }

  return ""
}

/**
 * 渲染一条任务行。
 *
 * @remarks 有列布局时输出三列（目标 / 任务 / 耗时），否则输出单列。
 * 两种形态都沿流程导轨排列，树形连接符保持弱化。
 *
 * @param row - 任务行内容。
 * @param depth - 当前 group 嵌套深度。
 * @param columns - 列布局；为空时使用单列形态。
 * @returns 可直接输出的整行文本。
 */
export function formatTaskRow(
  row: TaskRow,
  depth: number,
  columns?: ColumnLayout
): string {
  const indent = railPrefix(depth)

  const tree =
    row.last === undefined ? "" : theme.rail(row.last ? TREE_LAST : TREE_BRANCH)

  const symbol = row.frame ?? resultSymbol(row.status)

  const label = row.status === "error" ? theme.error(row.label) : row.label

  if (!columns) {
    const parts = [symbol, tree, row.target, label].filter(
      (part): part is string => part !== undefined && part !== ""
    )

    return `${indent}${parts.join(" ")}  ${renderDuration(row)}`.trimEnd()
  }

  const target = padEnd(row.target ?? "", columns.target)

  const paddedLabel = padEnd(label, columns.label)

  const duration = padStart(renderDuration(row), columns.duration)

  return `${indent}${symbol} ${tree} ${target}  ${paddedLabel}  ${duration}`.trimEnd()
}

/**
 * 渲染分组标题行。
 *
 * @param title - 标题。
 * @param depth - 当前 group 嵌套深度。
 * @returns 可直接输出的整行文本。
 */
export function formatGroupTitle(title: string, depth: number): string {
  return `${railPrefix(depth - 1)}${theme.accent("◆")} ${theme.accent(theme.title(title))}`
}

/**
 * 渲染分组说明行。
 *
 * @param description - 说明文本。
 * @param depth - 当前 group 嵌套深度。
 * @returns 可直接输出的整行文本。
 */
export function formatGroupNote(description: string, depth: number): string {
  return `${railPrefix(depth)}${theme.dim(description)}`
}

/**
 * 渲染失败输出的缩进块。
 *
 * @remarks 详情跟随任务缩进，保留流程导轨；正文的语义色由调用方决定。
 *
 * @param text - 单行文本。
 * @param depth - 当前 group 嵌套深度。
 * @param anchored - 是否为块的首行。
 * @returns 渲染后的行。
 */
export function formatDetail(text: string, depth: number, anchored = true): string {
  const indent = railPrefix(depth + 1)

  const anchor = anchored ? `${theme.rail("┌")} ` : `${theme.rail("│")} `

  return `${indent}${anchor}${text}`
}
