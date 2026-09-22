/** Rate Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { RateProps } from "element-plus"

/** Element Plus 评分 Renderer Props。 */
export interface RateRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<RateProps, "modelValue">> {
  /** 当前评分。 */
  value?: RateValue
  /** 评分变化回调。 */
  onChange?: (value: RateValue) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}

/** Element Plus 评分值类型。 */
export type RateValue = NonNullable<RateProps["modelValue"]>
