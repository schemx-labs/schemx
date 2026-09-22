/** Switch Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { SwitchProps } from "element-plus"

/** Element Plus Switch 支持的字段值。 */
export type SwitchValue = NonNullable<SwitchProps["modelValue"]>

/** Element Plus 开关 Renderer Props。 */
export interface SwitchRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<SwitchProps, "modelValue">> {
  /** 当前开关值。 */
  value?: SwitchValue
  /** 开关值变化回调。 */
  onChange?: (value: SwitchValue) => void | Promise<SwitchValue | void>
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
