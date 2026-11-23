/**
 * 数字输入渲染器类型定义
 *
 * @module renderers/NumberRenderer/types
 */

import type { InputValue, SchemxInputProps } from "@/components/Input"

export type NumberValue = InputValue

/**
 * 数字输入渲染器 Props
 *
 * 定义数字输入组件的所有可配置属性。
 */
export interface NumberRendererProps extends Omit<
  SchemxInputProps,
  "value" | "type" | "onChange"
> {
  /** 当前值 */
  value?: NumberValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 输入类型：number 支持小数，digit 仅支持整数 */
  type?: "number" | "digit"
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
  /** 是否可清除 */
  clearable?: boolean
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 最大输入长度 */
  maxlength?: number | string
}
