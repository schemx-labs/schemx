/**
 * 日期选择渲染器类型定义
 *
 * @module renderers/DateRenderer/types
 */
import type { DatePickerProps, FieldProps, PopupProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type DateValue = string | string[] | Date

/**
 * 日期选择渲染器 Props
 *
 * 定义日期选择组件的所有可配置属性。
 */
export interface DateRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<DatePickerProps, "modelValue" | "onUpdate:modelValue">> {
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
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /**
   * 内容区域对齐方式
   */
  contentAlign?: FieldProps["inputAlign"]
  /**
   * Popup 组件 Props 与事件透传
   *
   * 默认值：{ round: true, position: "bottom", safeAreaInsetBottom: true, teleport: "body" }
   *
   * 通过此属性可覆盖默认 Popup 配置或传入额外事件回调，
   * 避免组件顶层 Props 与 Popup 原生属性产生命名冲突。
   *
   * @example
   * ```ts
   * popupProps={{
   *   round: false,
   *   zIndex: 2000,
   *   closeOnClickOverlay: false,
   *   onOpened: () => console.log('popup opened'),
   *   onClickOverlay: () => console.log('overlay clicked'),
   * }}
   * ```
   */
  popupProps?: Partial<Omit<PopupProps, "show">>
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /**
   * 关闭回调
   *
   * 用户点击遮罩层或 Cascader 关闭按钮时触发，
   * 区别于 onConfirm（仅在选择完成时触发）。
   */
  onClose?: () => void
}
