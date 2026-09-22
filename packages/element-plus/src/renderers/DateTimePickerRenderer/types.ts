/** DateTimePicker Renderer 类型。 */

import type { DatePickerValue } from "../DatePickerRenderer/types"
import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { DatePickerProps } from "element-plus"

/** 日期时间选择器允许的类型。 */
export type DateTimePickerType = "datetime" | "datetimerange"

/** 日期时间选择器字段值。 */
export type DateTimePickerValue = DatePickerValue

/** Element Plus 日期时间 Renderer Props。 */
export interface DateTimePickerRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<
        DatePickerProps,
        "modelValue" | "type" | "disabled" | "placeholder" | "readonly"
      >
    > {
  /** 日期时间选择类型。 */
  type?: DateTimePickerType
  /** 当前日期时间值。 */
  value?: DateTimePickerValue
  /** 日期时间值变化回调。 */
  onChange?: (value: DateTimePickerValue) => void
  /** 日期时间选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 日期时间选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
