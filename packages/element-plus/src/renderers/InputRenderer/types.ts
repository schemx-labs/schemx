/** Input Renderer Props。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputProps } from "element-plus"

/** Element Plus 输入 Renderer 的字段值。 */
export type InputValue = string

/** Element Plus 输入 Renderer 的 Props。 */
export interface InputRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputProps, "modelValue" | "disabled" | "readonly" | "placeholder">> {
  /** 当前输入值。 */
  value?: InputValue
  /** 字段值变化回调。 */
  onChange?: (value: InputValue) => void
  /** 输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 是否禁用。 */
  disabled?: boolean
  /** 是否只读。 */
  readonly?: boolean
  /** 输入框占位符。 */
  placeholder?: string
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
