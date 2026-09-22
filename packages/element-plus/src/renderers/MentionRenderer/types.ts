/** Mention Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type {
  MentionInstance,
  MentionOption,
  MentionOptionProps,
  MentionProps,
} from "element-plus"

/** 提及字段值。 */
export type MentionValue = NonNullable<MentionProps["modelValue"]>

/** 提及选项。 */
export type MentionOptionItem = MentionOption

/** Element Plus 提及 Renderer Props。 */
export interface MentionRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<MentionProps, "modelValue" | "disabled" | "readonly">> {
  /** 当前提及文本。 */
  value?: MentionValue
  /** 提及选项列表。 */
  options?: MentionProps["options"]
  /** Element Plus 提及选项字段映射。 */
  props?: MentionOptionProps
  /** 提及文本变化回调。 */
  onChange?: (value: MentionValue) => void
  /** 提及输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 提及输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 搜索提及选项回调。 */
  onSearch?: (pattern: string, prefix: string) => void
  /** 选择提及选项回调。 */
  onSelect?: (option: MentionOptionItem, prefix: string) => void
  /** 整体删除提及文本回调。 */
  onWholeRemove?: (pattern: string, prefix: string) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}

/** Mention 实例类型。 */
export type MentionRendererInstance = MentionInstance
