/** ColorPicker Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { ColorPickerProps } from "element-plus"

/** 颜色选择器字段值。 */
export type ColorPickerValue = Exclude<ColorPickerProps["modelValue"], undefined>

/** Element Plus 颜色选择 Renderer Props。 */
export interface ColorPickerRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<ColorPickerProps, "modelValue" | "disabled">> {
  /** 当前颜色值。 */
  value?: ColorPickerValue
  /** 颜色值变化回调。 */
  onChange?: (value: ColorPickerValue) => void
  /** 颜色选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 颜色选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 当前激活颜色变化回调。 */
  onActiveChange?: (value: ColorPickerValue) => void
  /** 清空颜色回调。 */
  onClear?: () => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
