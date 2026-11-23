/**
 * 日历选择器渲染器类型定义
 *
 * @module renderers/CalendarRenderer/types
 */

import type { CalendarProps, FieldProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type CalendarValue = string | string[] | Date | Date[]
export type CalendarFormattedValue = string | string[]

/**
 * 日历选择器渲染器 Props
 *
 * 定义日历选择组件的所有可配置属性。
 */
export interface CalendarRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<CalendarProps, "show" | "onUpdate:show">> {
  /** 当前值，支持字符串、字符串数组或 Date 对象 */
  value?: CalendarValue
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: CalendarFormattedValue) => void
  /** 值变化回调，选中日期时触发 */
  onChange?: (value: CalendarFormattedValue) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹层 CSS 类名 */
  popupClassName?: string
  /** 详情展示模式 */
  view?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 日历类型：single 单选、range 范围选择、multiple 多选 */
  type?: CalendarProps["type"]
  /** 日历标题 */
  title?: CalendarProps["title"]
  /** 日期格式化字符串，如 "yyyy-MM-dd" */
  format?: string
  /** 范围选择时的分隔符 */
  separator?: string
  /**
   * 内容区域对齐方式
   */
  contentAlign?: FieldProps["inputAlign"]
}
