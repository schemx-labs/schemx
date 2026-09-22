/** Checkbox Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { CheckboxGroupProps, CheckboxProps } from "element-plus"

/** Element Plus Checkbox 的单个值。 */
export type CheckboxOptionValue = Exclude<NonNullable<CheckboxProps["value"]>, object>

/** Element Plus Checkbox 的字段值。 */
export type CheckboxValue = CheckboxOptionValue[]

/** Checkbox 选项。 */
export type CheckboxOption = NonNullable<CheckboxGroupProps["options"]>[number]

/** Element Plus 复选 Renderer Props。 */
export interface CheckboxRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<CheckboxGroupProps, "modelValue">> {
  /** 当前复选值列表。 */
  value?: CheckboxValue
  /** 复选选项列表。 */
  options?: CheckboxGroupProps["options"]
  /** Element Plus 复选选项字段映射。 */
  props?: CheckboxGroupProps["props"]
  /** 复选值变化回调。 */
  onChange?: (value: CheckboxValue) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
