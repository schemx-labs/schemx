/**
 * 弹窗选择渲染器类型定义
 *
 * @module renderers/SelectPickerRenderer/types
 */

import type { CheckboxProps, FieldProps, PopupProps, RadioProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type SelectPickerPrimitiveValue = RadioProps["name"] | CheckboxProps["name"]
export type SelectPickerValue = SelectPickerPrimitiveValue | SelectPickerPrimitiveValue[]

export type SelectPickerType = "radio" | "checkbox"

export type SelectPickerFieldNames = {
  label?: string
  value?: string
  disabled?: string
}

export interface SelectPickerOption {
  /** 选项标签 */
  label?: string
  /** 选项值 */
  value?: SelectPickerPrimitiveValue
  /** 是否禁用 */
  disabled?: boolean
  /** 扩展字段 */
  [key: string]: any
}

export interface SelectPickerConfirmEventParams {
  value: SelectPickerValue
  selectedItems: SelectPickerOption | SelectPickerOption[]
}

/**
 * 弹窗选择渲染器 Props
 *
 * 使用 Vant Field + Popup + Checkbox/Radio 组合实现单选/多选弹窗。
 */
export interface SelectPickerRendererProps extends Omit<
  SchemxBaseComponentProps,
  "onChange" | "onBlur" | "value" | "onUpdate:value"
> {
  /** 当前值 */
  value?: SelectPickerValue
  /** 值变化回调，确认选择后触发 */
  onChange?: (value: SelectPickerValue, detail: SelectPickerConfirmEventParams) => void
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: SelectPickerValue, detail: SelectPickerConfirmEventParams) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** 详情展示模式 */
  view?: boolean
  /** 选项数据 */
  options?: SelectPickerOption[]
  /** Picker 原生列数据兼容字段 */
  columns?: SelectPickerOption[]
  /** 字段名配置 */
  fieldNames?: SelectPickerFieldNames
  /** 单复选选择器类型 */
  type?: SelectPickerType
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 弹窗标题 */
  title?: string
  /** 内容区域对齐方式 */
  contentAlign?: FieldProps["inputAlign"]
  /** Popup 组件 Props 与事件透传 */
  popupProps?: Partial<Omit<PopupProps, "show">>
}
