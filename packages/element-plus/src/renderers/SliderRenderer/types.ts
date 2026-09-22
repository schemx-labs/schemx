/** Slider Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { SliderProps } from "element-plus"

/** Element Plus 滑块值类型。 */
export type SliderValue = NonNullable<SliderProps["modelValue"]>

/** Element Plus 滑块 Renderer Props。 */
export interface SliderRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<SliderProps, "modelValue" | "disabled">> {
  /** 当前滑块值。 */
  value?: SliderValue
  /** 滑块值变化回调。 */
  onChange?: (value: SliderValue) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
