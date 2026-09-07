/**
 * 输入渲染器类型定义
 *
 * @module renderers/InputRenderer/types
 */

import type { FieldProps } from "vant"

import type { InputValue, TextAreaAutosize } from "../../components/Input/types"
import type { SchemxBaseComponentProps } from "@schemx/core"

export type { InputValue }
export { cutString, formatNumber, getStringLength } from "../../components/Input/types"

/**
 * 输入渲染器 Props
 *
 * 这里保持为显式接口，避免 Vue SFC 编译器解析跨文件 extends 时失败。
 */
export interface InputRendererProps extends Omit<
  SchemxBaseComponentProps,
  "onChange" | "onBlur" | "value" | "onUpdate:value"
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
  type?: FieldProps["type"]
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 占位提示文本 */
  placeholder?: string
  /** 是否自动聚焦 */
  autofocus?: boolean
  /** 最大输入长度 */
  maxlength?: number | string
  /** 最小值（数字类型） */
  min?: number
  /** 最大值（数字类型） */
  max?: number
  /** 文本域默认行数 */
  rows?: number | string
  /** 文本域自适应高度配置 */
  autosize?: boolean | TextAreaAutosize
  /** 自定义格式化函数 */
  formatter?: FieldProps["formatter"]
  /** 格式化触发时机 */
  formatTrigger?: FieldProps["formatTrigger"]
  /** 是否可清除 */
  clearable?: FieldProps["clearable"]
  /** 清除图标名称 */
  clearIcon?: FieldProps["clearIcon"]
  /** 清除按钮触发方式 */
  clearTrigger?: FieldProps["clearTrigger"]
  /** 左侧图标名称 */
  leftIcon?: FieldProps["leftIcon"]
  /** 右侧图标名称 */
  rightIcon?: FieldProps["rightIcon"]
  /** 是否显示字数统计 */
  showWordLimit?: FieldProps["showWordLimit"]
  /** 自定义 CSS 类名 */
  className?: string
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 自动完成属性 */
  autocomplete?: string
  /** 自动大写属性 */
  autocapitalize?: string
  /** 自动纠正属性 */
  autocorrect?: string
  /** 回车键类型提示 */
  enterkeyhint?: FieldProps["enterkeyhint"]
  /** 拼写检查 */
  spellcheck?: boolean | null
  /** 输入模式 */
  inputmode?: FieldProps["inputmode"]
  /** 文本对齐方式 */
  align?: "left" | "right" | "center"
}
