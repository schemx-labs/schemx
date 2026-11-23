/**
 * 文本域输入渲染器类型定义
 *
 * @module renderers/TextAreaRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { TextareaProps } from "@wot-ui/ui/components/wd-textarea/types"

export type TextAreaValue = TextareaProps["modelValue"]

/**
 * 文本域输入渲染器 Props
 *
 * 定义文本域输入组件的所有可配置属性。
 */
export interface TextAreaRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<TextareaProps, "modelValue" | "onUpdate:modelValue" | "onChange">> {
  /** 当前值 */
  value?: TextAreaValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: TextareaProps["readonly"]
  /** 是否禁用 */
  disabled?: TextareaProps["disabled"]
}
