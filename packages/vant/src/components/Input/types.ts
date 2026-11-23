/**
 * 输入组件类型定义
 *
 * @module components/Input/types
 */

import type { FieldProps, FieldAutosizeConfig } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type InputValue = FieldProps["modelValue"]

/**
 * 文本域自适应高度配置
 *
 * 配置文本域根据内容自动调整高度的行为。
 * 支持两种格式：
 * 1. 基于行数：minRows / maxRows
 * 2. 基于像素：minHeight / maxHeight
 */
export interface TextAreaAutosize {
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
  /** 最小高度（像素） */
  minHeight?: number
  /** 最大高度（像素） */
  maxHeight?: number
}

/**
 * 输入组件 Props
 *
 * 定义输入组件的所有可配置属性。
 */
export interface SchemxInputProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
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
  autosize?: boolean | FieldAutosizeConfig | TextAreaAutosize
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

/** @deprecated 请使用 SchemxInputProps。 */
export type InputRendererProps = SchemxInputProps

/**
 * 格式化数字输入
 *
 * @param value - 输入值
 * @param allowDot - 是否允许小数点
 * @param allowMinus - 是否允许负号
 * @returns 格式化后的值
 */
export function formatNumber(value: string, allowDot = true, allowMinus = true): string {
  if (allowDot) {
    value = value.replace(/[^-0-9.]/g, "")
    // 只保留第一个小数点
    const dotIndex = value.indexOf(".")

    if (dotIndex !== -1) {
      value = value.slice(0, dotIndex + 1) + value.slice(dotIndex + 1).replace(/\./g, "")
    }
  } else {
    value = value.replace(/[^-0-9]/g, "")
  }

  if (allowMinus) {
    // 负号只能在开头
    const minusIndex = value.indexOf("-")

    if (minusIndex > 0) {
      value = value.replace(/-/g, "")
    } else if (minusIndex === 0) {
      value = "-" + value.slice(1).replace(/-/g, "")
    }
  } else {
    value = value.replace(/-/g, "")
  }

  return value
}

/**
 * 获取字符串长度（考虑 emoji 等特殊字符）
 *
 * @param str - 字符串
 * @returns 字符串长度
 */
export function getStringLength(str: string): number {
  return [...String(str)].length
}

/**
 * 截取字符串
 *
 * @param str - 字符串
 * @param maxLength - 最大长度
 * @returns 截取后的字符串
 */
export function cutString(str: string, maxLength: number): string {
  return [...String(str)].slice(0, maxLength).join("")
}
