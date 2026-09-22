/** Cascader Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { CascaderComponentProps, CascaderProps, CascaderValue } from "element-plus"

/** Element Plus Cascader 的字段值。 */
export type CascaderValueType = CascaderValue | null

/** Element Plus 级联 Renderer Props。 */
export interface CascaderRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<CascaderComponentProps, "modelValue" | "disabled" | "placeholder">> {
  /** 当前级联值。 */
  value?: CascaderValueType
  /** 级联选项列表。 */
  options?: CascaderComponentProps["options"]
  /** Element Plus 级联字段映射与行为配置。 */
  props?: CascaderProps
  /** 级联值变化回调。 */
  onChange?: (value: CascaderValueType) => void
  /** 级联控件失焦回调。 */
  onBlur?: (value: CascaderValueType) => void
  /** 级联控件聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
