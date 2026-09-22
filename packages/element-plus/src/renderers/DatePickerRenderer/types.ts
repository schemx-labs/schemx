/** DatePicker Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { DatePickerProps } from "element-plus"

/** Element Plus DatePicker 的字段值。 */
export type DatePickerValue = DatePickerProps["modelValue"]

/** Element Plus 日期选择 Renderer Props。 */
export interface DatePickerRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<DatePickerProps, "modelValue" | "disabled" | "placeholder" | "readonly">
    > {
  /** 当前日期值。 */
  value?: DatePickerValue
  /** 日期值变化回调。 */
  onChange?: (value: DatePickerValue) => void
  /** 日期控件失焦回调。 */
  onBlur?: (value: DatePickerValue) => void
  /** 日期控件聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
