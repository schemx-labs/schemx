/**
 * 输入渲染器类型定义
 *
 * @module renderers/InputRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputProps } from "@wot-ui/ui/components/wd-input/types"

export type InputValue = InputProps["modelValue"]

/**
 * 输入渲染器 Props
 *
 * 定义输入组件的所有可配置属性。
 */
export interface InputRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<
        InputProps,
        | "modelValue"
        | "value"
        | "type"
        | "onUpdate:modelValue"
        | "onChange"
        | "onBlur"
        | "onFocus"
      >
    > {
  /** 当前值 */
  value?: InputValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 输入类型 */
  type?: InputProps["type"]
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 是否自动聚焦 */
  autofocus?: boolean
  /** 最大输入长度 */
  maxlength?: InputProps["maxlength"]
  /** 自定义 CSS 类名 */
  className?: string
  /** 自动完成属性 */
  autocomplete?: string
  /** 自动大写属性 */
  autocapitalize?: string
  /** 自动纠正属性 */
  autocorrect?: string
  /** 输入模式 */
  inputmode?: InputProps["inputmode"]
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
}
