/**
 * 单选框渲染器类型定义
 *
 * @module renderers/RadioRenderer/types
 */

import type { RadioProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type RadioValue = RadioProps["name"]

/**
 * 单选选项
 *
 * 描述单个单选项的配置信息。
 */
export interface RadioOption
  extends Partial<Omit<RadioProps, "modelValue" | "onUpdate:modelValue" | "name">> {
  /** 选项标签 */
  label?: string
  /** 选项值 */
  value?: RadioValue
  /** 扩展字段 */
  [key: string]: any
}

/**
 * 单选框渲染器 Props
 *
 * 定义单选框组件的所有可配置属性。
 */
export interface RadioRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<RadioProps, "modelValue" | "onUpdate:modelValue" | "name">> {
  /** 当前值 */
  value?: RadioValue
  /** 值变化回调 */
  onChange?: (value: RadioValue) => void
  /** 选项列表 */
  options?: RadioOption[]
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
