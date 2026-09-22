/** VirtualizedSelect Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { ScrollbarDirection, SelectV2Instance, SelectV2Props } from "element-plus"

/** 虚拟化选择器选项。 */
export type VirtualizedSelectOption = NonNullable<SelectV2Props["options"]>[number]

/** 虚拟化选择器字段值。 */
export type VirtualizedSelectValue = Exclude<SelectV2Props["modelValue"], undefined>

/** Element Plus 虚拟化 Select Renderer Props。 */
export interface VirtualizedSelectRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<SelectV2Props, "modelValue" | "disabled" | "placeholder">> {
  /** 当前选择值。 */
  value?: VirtualizedSelectValue
  /** 选择项列表。 */
  options?: SelectV2Props["options"]
  /** Element Plus 虚拟化选择项字段映射。 */
  props?: SelectV2Props["props"]
  /** 选择值变化回调。 */
  onChange?: (value: VirtualizedSelectValue) => void
  /** 选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 删除多选标签回调。 */
  onRemoveTag?: (value: VirtualizedSelectValue) => void
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

/** 虚拟化 Select 实例类型。 */
export type VirtualizedSelectRendererInstance = SelectV2Instance
