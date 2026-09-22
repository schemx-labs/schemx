/** SensitiveInput Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputProps } from "element-plus"

/** 脱敏输入值类型。 */
export type SensitiveInputValue = string

/** 脱敏展示格式化函数。 */
export type SensitiveMaskFormatter = (
  value: string,
  context: {
    placeholder: string
    readonlyPlaceholder: string
  }
) => string

/** 脱敏输入 Renderer Props。 */
export interface SensitiveInputRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputProps, "modelValue" | "type" | "disabled" | "readonly">> {
  /** 当前真实值。 */
  value?: SensitiveInputValue
  /** 真实值变化回调。 */
  onChange?: (value: SensitiveInputValue) => void
  /** 输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 完整值格式化函数。 */
  formatter?: (value: string) => string
  /** 只读态脱敏展示函数。 */
  maskFormatter?: SensitiveMaskFormatter
  /** 初始是否显示真实值。 */
  defaultRevealed?: boolean
  /** 受控显示状态。 */
  revealed?: boolean
  /** 显示状态变化回调。 */
  onRevealChange?: (revealed: boolean) => void
  /** 是否允许显示真实值。 */
  revealable?: boolean
  /** 显示按钮文案。 */
  revealText?: string
  /** 隐藏按钮文案。 */
  hideText?: string
  /** 显示按钮图标。 */
  revealIcon?: InputProps["suffixIcon"]
  /** 隐藏按钮图标。 */
  hideIcon?: InputProps["suffixIcon"]
  /** 显示后是否自动聚焦。 */
  focusOnReveal?: boolean
  /** 失焦后是否恢复脱敏状态。 */
  hideOnBlur?: boolean
  /** 只读态是否允许查看真实值。 */
  revealWhenReadonly?: boolean
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
