/** InputTag Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputTagProps } from "element-plus"

/** 标签输入字段值。 */
export type InputTagValue = NonNullable<InputTagProps["modelValue"]>

/** Element Plus 标签输入 Renderer Props。 */
export interface InputTagRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputTagProps, "modelValue" | "disabled">> {
  /** 当前标签列表。 */
  value?: InputTagValue
  /** 标签列表变化回调。 */
  onChange?: (value: InputTagValue) => void
  /** 标签输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 标签输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 新增标签回调；粘贴分隔内容时可能一次新增多个标签。 */
  onAddTag?: (value: string | string[]) => void
  /** 删除标签回调。 */
  onRemoveTag?: (value: string, index: number) => void
  /** 清空标签回调。 */
  onClear?: () => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
