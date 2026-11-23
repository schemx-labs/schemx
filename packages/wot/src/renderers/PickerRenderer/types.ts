/**
 * 选择渲染器类型定义
 *
 * @module renderers/PickerRenderer/types
 */
import type { PickerOption } from "@wot-ui/ui/components/wd-picker-view/types"
import type { PickerProps } from "@wot-ui/ui/components/wd-picker/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type PickerValue = string | number | Array<string | number>
export type PickerFieldNames = {
  text?: string
  label?: string
  value?: string
  children?: string
}

export interface PickerConfirmEventParams {
  value: Array<string | number>
  selectedItems: PickerOption[]
}

/**
 * 选择渲染器 Props
 *
 * 定义选择组件的所有可配置属性。
 */
export interface PickerRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<PickerProps, "modelValue" | "onUpdate:modelValue">> {
  /** 当前值 */
  value?: PickerValue
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: PickerValue, detail: PickerConfirmEventParams) => void
  /** 值变化回调，选中项变化时触发 */
  onChange?: (value: PickerValue, detail: PickerConfirmEventParams) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否返回完整路径 */
  emitPath?: boolean
  /** 是否显示所有层级 */
  showAllLevels?: boolean
  /** 分隔符 */
  separator?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 弹窗标题 */
  title?: string
  /** 选项数据 */
  options?: PickerOption[]
  /** Picker 原生列数据 */
  columns?: PickerProps["columns"]
  /** 字段名配置 */
  fieldNames?: PickerFieldNames
  /** 内容区域对齐方式 */
  contentAlign?: "left" | "center" | "right"
  /** 弹窗 CSS 类名 */
  popupClassName?: string
}
