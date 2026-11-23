/**
 * 选择组渲染器类型定义
 *
 * @module renderers/SelectorRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type SelectValue = string | number | (string | number)[]

/**
 * 选择器选项
 *
 * 描述单个选择器选项的配置信息。
 */
export interface SelectorOption {
  /** 选项标签 */
  label?: string
  /** 选项值 */
  value?: SelectValue
  /** 是否禁用 */
  disabled?: boolean
  /** 扩展字段 */
  [key: string]: any
}

/**
 * 选择器子组件 Props
 *
 * 定义选择器子组件的属性。
 */
export interface SelectorProps {
  /** 当前值 */
  modelValue?: SelectValue
  /** 选项列表 */
  options?: SelectorOption[]
  /** 是否多选 */
  multiple?: boolean
  /** 字段名映射 */
  fieldNames?: {
    /** 标签字段名 */
    label?: string
    /** 值字段名 */
    value?: string
    /** 禁用字段名 */
    disabled?: string
  }
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 选择组渲染器 Props
 *
 * 定义选择组组件的所有可配置属性。
 */
export interface SelectorRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值 */
  value?: SelectValue
  /** 值变化回调 */
  onChange?: (value: SelectValue) => void
  /** 选项列表 */
  options?: SelectorOption[]
  /** 自定义 CSS 类名 */
  className?: string
  /** 字段名映射 */
  fieldNames?: {
    /** 标签字段名 */
    label?: string
    /** 值字段名 */
    value?: string
    /** 禁用字段名 */
    disabled?: string
  }
  /** 是否只读 */
  readonly?: boolean
  /** 是否详情展示 */
  view?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
}
