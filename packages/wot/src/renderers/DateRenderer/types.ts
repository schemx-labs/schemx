/**
 * 日期选择渲染器类型定义
 *
 * @module renderers/DateRenderer/types
 */
import type { DatetimePickerProps } from "@wot-ui/ui/components/wd-datetime-picker/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type DateValue = string | string[] | number | number[] | Date

/**
 * 日期选择渲染器 Props
 *
 * 定义日期选择组件的所有可配置属性。
 */
export interface DateRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<DatetimePickerProps, "modelValue" | "onUpdate:modelValue" | "visible" | "onUpdate:visible">> {
  /** 当前值，支持字符串、字符串数组或 Date 对象 */
  value?: DateValue
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: string) => void
  /** 值变化回调，选中日期时触发 */
  onChange?: (value: string) => void
  /** 日期格式化字符串或格式化函数 */
  format?: string | ((value: any) => string)
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 内容区域对齐方式 */
  contentAlign?: "left" | "center" | "right"
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** 关闭回调 */
  onClose?: () => void
}
