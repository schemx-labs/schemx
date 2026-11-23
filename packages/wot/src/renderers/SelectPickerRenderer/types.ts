/**
 * 选择弹窗渲染器类型定义
 *
 * @module renderers/SelectPickerRenderer/types
 */

import type {
  SelectPickerProps,
  SelectPickerType,
} from "@wot-ui/ui/components/wd-select-picker/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type SelectPickerPrimitiveValue = string | number | boolean
export type SelectPickerValue = SelectPickerPrimitiveValue | SelectPickerPrimitiveValue[]

export type SelectPickerFieldNames = {
  label?: string
  value?: string
}

export interface SelectPickerOption {
  label?: string
  value?: SelectPickerPrimitiveValue
  disabled?: boolean
  [key: string]: any
}

export interface SelectPickerConfirmEventParams {
  value: SelectPickerValue
  selectedItems: SelectPickerOption | SelectPickerOption[]
}

/**
 * 选择弹窗渲染器 Props
 *
 * 定义基于 Wot UI SelectPicker 的选择弹窗渲染器属性。
 */
export interface SelectPickerRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<SelectPickerProps, "modelValue" | "onUpdate:modelValue" | "visible" | "columns">> {
  /** 当前值 */
  value?: SelectPickerValue
  /** 值变化回调，确认选择后触发 */
  onChange?: (value: SelectPickerValue, detail: SelectPickerConfirmEventParams) => void
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: SelectPickerValue, detail: SelectPickerConfirmEventParams) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 选项数据 */
  options?: SelectPickerOption[]
  /** SelectPicker 原生列数据 */
  columns?: SelectPickerOption[]
  /** 字段名配置 */
  fieldNames?: SelectPickerFieldNames
  /** 单复选选择器类型 */
  type?: SelectPickerType
  /** 内容区域对齐方式 */
  contentAlign?: "left" | "center" | "right"
}
