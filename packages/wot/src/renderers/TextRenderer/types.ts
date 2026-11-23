/**
 * 文本输入渲染器类型定义
 *
 * @module renderers/TextRenderer/types
 */

import type { InputRendererProps, InputValue } from "../InputRenderer"
import type { InputProps } from "@wot-ui/ui/components/wd-input/types"

export type TextValue = Extract<InputValue, string>

/**
 * 文本输入渲染器 Props
 *
 * 定义文本输入组件的所有可配置属性。
 */
export interface TextRendererProps
  extends /* @vue-ignore */ Omit<InputRendererProps, "value" | "onChange" | "type"> {
  /** 自定义 CSS 类名 */
  className?: string
  /** 占位提示文本 */
  placeholder?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 当前值 */
  value?: TextValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
  /** 输入类型 */
  type?: InputProps["type"] | "password"
  /** 是否可清除 */
  clearable?: boolean
  /** 清除按钮触发方式 */
  clearTrigger?: "focus" | "always"
  /** 左侧图标名称 */
  leftIcon?: string
  /** 右侧图标名称 */
  rightIcon?: string
  /** 是否显示字数统计 */
  showWordLimit?: boolean
  /** 最大输入长度 */
  maxlength?: InputProps["maxlength"]
  /** 是否自动聚焦 */
  autofocus?: boolean
}
