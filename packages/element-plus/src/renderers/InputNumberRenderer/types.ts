/** InputNumber Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputNumberProps } from "element-plus"

/** Element Plus InputNumber 的字段值。 */
export type InputNumberValue = Exclude<InputNumberProps["modelValue"], undefined>

/** Element Plus 数字输入 Renderer Props。 */
export interface InputNumberRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputNumberProps, "modelValue">> {
  /** 当前数字值，空值使用 null。 */
  value?: InputNumberValue
  /** 数值变化回调。 */
  onChange?: (value: InputNumberValue) => void
  /** 失焦回调。 */
  onBlur?: (value: InputNumberValue) => void
  /** 聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
