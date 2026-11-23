/**
 * 选择渲染器类型定义
 *
 * @module renderers/PickerRenderer/types
 */
import type {
  FieldProps,
  PickerConfirmEventParams,
  PickerOption,
  PickerProps,
  PopupProps,
  PickerFieldNames as VantPickerFieldNames,
} from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type PickerValue = PickerProps["modelValue"][number] | PickerProps["modelValue"]

/**
 * 选择渲染器字段名配置
 *
 * 自定义选项数据中各字段对应的键名。
 */
export type PickerFieldNames = VantPickerFieldNames

/**
 * 选择渲染器 Props
 *
 * 定义选择组件的所有可配置属性。
 */
export interface PickerRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
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
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 弹窗标题 */
  title?: string
  /** 选项数据 */
  options?: PickerOption[]
  /** Picker 原生列数据 */
  columns?: PickerProps["columns"]
  /** Picker 原生字段名配置 */
  columnsFieldNames?: PickerProps["columnsFieldNames"]
  /** 字段名配置 */
  fieldNames?: PickerFieldNames
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
}
