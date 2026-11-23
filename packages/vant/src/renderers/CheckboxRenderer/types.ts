/**
 * 复选框渲染器类型定义
 *
 * @module renderers/CheckboxRenderer/types
 */

import type { CheckboxProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type CheckboxOptionValue = CheckboxProps["name"]
export type CheckboxValue = CheckboxOptionValue[] | string

/**
 * 复选选项
 *
 * 描述单个复选项的配置信息。
 */
export interface CheckboxOption
  extends Partial<
    Omit<CheckboxProps, "modelValue" | "onUpdate:modelValue" | "onChange" | "name">
  > {
  /** 选项标签 */
  label?: string
  /** 选项值 */
  value?: CheckboxOptionValue
  /** 扩展字段 */
  [key: string]: any
}

/**
 * 复选框渲染器 Props
 *
 * 定义复选框组件的所有可配置属性。
 */
export interface CheckboxRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<CheckboxProps, "modelValue" | "onUpdate:modelValue" | "onChange" | "name">
    > {
  /** 当前值（数组形式） */
  value?: CheckboxValue
  /** 值变化回调 */
  onChange?: (value: CheckboxValue) => void
  /** 选项列表 */
  options?: CheckboxOption[]
  /** 字段名映射 */
  fieldNames?: {
    /** 标签字段名 */
    label?: string
    /** 值字段名 */
    value?: string
    /** 禁用字段名 */
    disabled?: string
  }
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否详情展示 */
  view?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
}
