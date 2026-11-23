/**
 * 数字输入渲染器类型定义
 *
 * @module renderers/NumberRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputProps } from "@wot-ui/ui/components/wd-input/types"

export type NumberInputType = Extract<InputProps["type"], "number" | "digit">

export type NumberValue = InputProps["modelValue"]

/**
 * 数字输入渲染器 Props
 *
 * 定义数字输入组件的所有可配置属性。
 */
export interface NumberRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<InputProps, "modelValue" | "onUpdate:modelValue" | "onChange" | "type">
    > {
  /** 当前值 */
  value?: NumberValue
  /** 值变化回调 */
  onChange?: (value: NumberValue) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 输入类型 */
  type?: NumberInputType
}
