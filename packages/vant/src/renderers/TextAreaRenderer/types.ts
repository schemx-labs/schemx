/**
 * 文本域输入渲染器类型定义
 *
 * @module renderers/TextAreaRenderer/types
 */

import type { InputValue, SchemxInputProps } from "@/components/Input"

export type TextAreaValue = InputValue

/**
 * 文本域自适应高度配置
 *
 * 配置文本域根据内容自动调整高度的行为。
 * 支持两种格式：
 * 1. 基于行数：minRows / maxRows
 * 2. 基于像素：minHeight / maxHeight
 */
export interface TextAreaAutosize {
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
  /** 最小高度（像素） */
  minHeight?: number
  /** 最大高度（像素） */
  maxHeight?: number
}

/**
 * 文本域输入渲染器 Props
 *
 * 定义文本域输入组件的所有可配置属性。
 */
export interface TextAreaRendererProps extends Omit<
  SchemxInputProps,
  "value" | "type" | "onChange"
> {
  /** 当前值 */
  value?: TextAreaValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 自适应高度配置 */
  autosize?: boolean | TextAreaAutosize
  /** 自适应高度配置（兼容旧属性名） */
  autoSize?: boolean | TextAreaAutosize
  /** 默认行数 */
  rows?: number | string
  /** 最大输入长度 */
  maxlength?: number | string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
  /** 是否显示字数统计 */
  showWordLimit?: boolean
}
