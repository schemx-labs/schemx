/**
 * 级联选择器渲染器类型定义
 *
 * @module renderers/CascaderRenderer/types
 */

import type { CascaderOption, CascaderProps } from "@wot-ui/ui/components/wd-cascader/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type CascaderValue = Array<string | number>
export type CascaderFieldNames = {
  text?: string
  label?: string
  value?: string
  children?: string
  disabled?: string
}

/**
 * 级联选择器渲染器 Props
 *
 * 定义级联选择组件的所有可配置属性。
 */
export interface CascaderRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<CascaderProps, "modelValue" | "onUpdate:modelValue">> {
  /** 当前值 */
  value?: CascaderValue
  /** 确认回调，用户选择完成时触发 */
  onConfirm?: (value: CascaderValue) => void
  /** 值变化回调，选中项变化时触发 */
  onChange?: (value: CascaderValue) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否显示所有层级 */
  showAllLevels?: boolean
  /** 是否返回完整路径 */
  emitPath?: boolean
  /** 字段名配置 */
  fieldNames?: CascaderFieldNames
  /** 分隔符 */
  separator?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 选项数据 */
  options?: CascaderOption[]
  /** 内容区域对齐方式 */
  contentAlign?: "left" | "center" | "right"
  /** 弹窗标题 */
  title?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
}
