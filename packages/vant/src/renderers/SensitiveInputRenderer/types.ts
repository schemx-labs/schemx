/**
 * 脱敏输入渲染器类型定义
 *
 * @module renderers/SensitiveInputRenderer/types
 */

import type { SchemxInputProps } from "@/components/Input"

export type SensitiveInputValue = string

export type SensitiveMaskFormatter = (
  value: string,
  ctx: {
    placeholder: string
    readonlyPlaceholder: string
  }
) => string

export interface SensitiveInputRendererProps extends Omit<
  SchemxInputProps,
  "type" | "value" | "onChange"
> {
  /** 当前真实值 */
  value?: SensitiveInputValue
  /** 值变化回调，始终回传真实值 */
  onChange?: (value: string) => void
  /** 完整值格式化，展示完整值和输入时使用 */
  formatter?: (value: string) => string
  /** 脱敏值格式化，仅用于默认展示态 */
  maskFormatter?: SensitiveMaskFormatter
  /** 默认是否显示完整值 */
  defaultRevealed?: boolean
  /** 受控显示状态 */
  revealed?: boolean
  /** 显示状态变化回调 */
  onRevealChange?: (revealed: boolean) => void
  /** 是否允许显示完整值 */
  revealable?: boolean
  /** 显示按钮文案 */
  revealText?: string
  /** 隐藏按钮文案 */
  hideText?: string
  /** 显示按钮图标 */
  revealIcon?: string
  /** 隐藏按钮图标 */
  hideIcon?: string
  /** 展开后是否自动聚焦输入框 */
  focusOnReveal?: boolean
  /** 输入框失焦后是否自动恢复脱敏态 */
  hideOnBlur?: boolean
  /** 只读时是否允许查看完整值 */
  revealWhenReadonly?: boolean
}

export function defaultMaskFormatter(value: string): string {
  const chars = [...value]
  const length = chars.length

  if (length <= 0) return ""
  if (length <= 2) return "*".repeat(length)
  if (length <= 6) return `${chars[0]}****${chars[length - 1]}`

  return `${chars.slice(0, 3).join("")}****${chars.slice(-4).join("")}`
}
