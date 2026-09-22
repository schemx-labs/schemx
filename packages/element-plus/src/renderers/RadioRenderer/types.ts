/** Radio Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { RadioGroupProps } from "element-plus"

/** Element Plus Radio 的字段值。 */
export type RadioValue = NonNullable<RadioGroupProps["modelValue"]>

/** Radio 选项。 */
export type RadioOption = NonNullable<RadioGroupProps["options"]>[number]

/** Element Plus 单选 Renderer Props。 */
export interface RadioRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<RadioGroupProps, "modelValue">> {
  /** 当前单选值。 */
  value?: RadioValue
  /** 单选选项列表。 */
  options?: RadioGroupProps["options"]
  /** Element Plus 单选选项字段映射。 */
  props?: RadioGroupProps["props"]
  /** 单选值变化回调。 */
  onChange?: (value: RadioValue) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
