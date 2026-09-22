/** TimePicker Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { ModelValueType, TimePickerDefaultProps } from "element-plus"

/** TimePicker 原生组件 Props。 */
type TimePickerComponentProps = TimePickerDefaultProps

/** 时间选择器字段值。 */
export type TimePickerValue = ModelValueType | null

/** Element Plus 时间选择 Renderer Props。 */
export type TimePickerRendererProps =
  /* @vue-ignore */
  Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value"> &
    Partial<
      Omit<
        TimePickerComponentProps,
        | "modelValue"
        | "disabled"
        | "placeholder"
        | "readonly"
        | "key"
        | "ref"
        | "ref_for"
        | "ref_key"
        | "onUpdate:modelValue"
        | "onBlur"
        | "onFocus"
      >
    > & {
      /** 当前时间值。 */
      value?: TimePickerValue
      /** 时间值变化回调。 */
      onChange?: (value: TimePickerValue) => void
      /** 时间选择器失焦回调。 */
      onBlur?: (event: FocusEvent) => void
      /** 时间选择器聚焦回调。 */
      onFocus?: (event: FocusEvent) => void
      /** Renderer 根节点的 CSS 类名。 */
      className?: string
      /** 只读状态下的空值占位文本。 */
      readonlyPlaceholder?: string
    }
