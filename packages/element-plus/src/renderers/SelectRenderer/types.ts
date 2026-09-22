/** Select Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { ScrollbarDirection, SelectInstance, SelectProps } from "element-plus"

/** Select 选项。 */
export type SelectOption = NonNullable<SelectProps["options"]>[number]

/** Select 字段值。 */
export type SelectValue = Exclude<SelectProps["modelValue"], undefined>

/** Element Plus Select Renderer Props。 */
export interface SelectRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<SelectProps, "modelValue" | "disabled">> {
  /** 当前选择值。 */
  value?: SelectValue
  /** 选择项列表。 */
  options?: SelectProps["options"]
  /** Element Plus 选择项字段映射。 */
  props?: SelectProps["props"]
  /** 选择值变化回调。 */
  onChange?: (value: SelectValue) => void
  /** 选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 删除多选标签回调。 */
  onRemoveTag?: (value: SelectValue) => void
  /** 下拉面板显示状态变化回调。 */
  onVisibleChange?: (visible: boolean) => void
  /** 清空选择回调。 */
  onClear?: () => void
  /** 下拉列表滚动到底部回调。 */
  onEndReached?: (direction: ScrollbarDirection) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}

/** Select 实例类型。 */
export type SelectRendererInstance = SelectInstance
