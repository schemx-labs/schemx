/** Autocomplete Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type {
  AutocompleteData,
  AutocompleteFetchSuggestions,
  AutocompleteInstance,
  AutocompleteProps,
} from "element-plus"

/** Autocomplete 字段值。 */
export type AutocompleteValue = NonNullable<AutocompleteProps["modelValue"]>

/** Autocomplete 本地建议项。 */
export type AutocompleteOption = AutocompleteData[number]

/** Autocomplete 建议项字段名映射。 */
export interface AutocompleteOptionProps {
  /** 建议项显示文本字段。 */
  label?: string
  /** 建议项值字段。 */
  value?: string
  /** 建议项禁用状态字段。 */
  disabled?: string
}

/** Element Plus 自动补全 Renderer Props。 */
export interface AutocompleteRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<AutocompleteProps, "modelValue" | "disabled" | "readonly">> {
  /** 当前输入值。 */
  value?: AutocompleteValue
  /** 本地建议项。 */
  options?: AutocompleteData
  /** 建议项字段名映射。 */
  props?: AutocompleteOptionProps
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
  /** 输入值变化回调。 */
  onChange?: (value: AutocompleteValue) => void
  /** 输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 建议项选择回调。 */
  onSelect?: (item: AutocompleteOption) => void
}

/** Autocomplete 远程建议函数类型。 */
export type AutocompleteSuggestions = AutocompleteFetchSuggestions

/** Autocomplete 实例类型。 */
export type AutocompleteRendererInstance = AutocompleteInstance
