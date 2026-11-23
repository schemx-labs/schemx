/**
 * 单选框渲染器类型定义
 *
 * @module renderers/RadioRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { ExtractPropTypes } from "vue"
import { radioProps } from "@wot-ui/ui/components/wd-radio/types"
import type { RadioProps } from "@wot-ui/ui/components/wd-radio-group/types"

export type RadioValue = RadioProps["modelValue"]
type RadioOptionProps = ExtractPropTypes<typeof radioProps>

/**
 * 单选选项
 *
 * 描述单个单选项的配置信息。
 */
export interface RadioOption
  extends /* @vue-ignore */ Partial<Omit<RadioOptionProps, "modelValue" | "onUpdate:modelValue" | "value">> {
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
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<RadioProps, "modelValue" | "onUpdate:modelValue">> {
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
  /** 是否禁用 */
  disabled?: boolean
}
