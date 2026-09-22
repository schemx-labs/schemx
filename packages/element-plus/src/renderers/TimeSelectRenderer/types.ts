/** TimeSelect Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { TimeSelectProps } from "element-plus"

/** 固定时间选择字段值。 */
export type TimeSelectValue = Exclude<TimeSelectProps["modelValue"], undefined>

/** Element Plus 固定时间选择 Renderer Props。 */
export interface TimeSelectRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<TimeSelectProps, "modelValue" | "disabled" | "placeholder">> {
  /** 当前固定时间值。 */
  value?: TimeSelectValue
  /** 固定时间值变化回调。 */
  onChange?: (value: TimeSelectValue) => void
  /** 固定时间选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 固定时间选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 清空固定时间回调。 */
  onClear?: () => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
