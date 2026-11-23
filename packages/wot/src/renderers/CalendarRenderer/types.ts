/**
 * 日历选择器渲染器类型定义
 *
 * @module renderers/CalendarRenderer/types
 */

import type { CalendarProps } from "@wot-ui/ui/components/wd-calendar/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type CalendarValue = string | string[] | Date | Date[] | number | number[] | null
export type CalendarFormattedValue = string | string[]
export type CalendarSelectionType = CalendarProps["type"]

/**
 * 日历选择器渲染器 Props
 *
 * 定义日历选择组件的所有可配置属性。
 */
export interface CalendarRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<
        CalendarProps,
        "visible" | "onUpdate:visible" | "modelValue" | "onUpdate:modelValue" | "type"
      >
    > {
  /** 当前值，支持字符串、字符串数组或 Date 对象 */
  value?: CalendarValue
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: CalendarFormattedValue) => void
  /** 值变化回调，选中日期时触发 */
  onChange?: (value: CalendarFormattedValue) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 日期格式化字符串，如 "YYYY-MM-DD" */
  format?: string
  /** 选择类型，兼容 single/multiple/range 写法 */
  type?: CalendarSelectionType
  /** 范围选择时的分隔符 */
  separator?: string
  /** 内容区域对齐方式 */
  contentAlign?: "left" | "center" | "right"
}
