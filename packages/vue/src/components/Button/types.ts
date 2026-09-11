/**
 * 内置 Button 组件的公开类型。
 *
 * @module components/Button/types
 */

import type { ButtonHTMLAttributes } from "vue"

/**
 * 内置按钮的尺寸。
 */
export type SchemxButtonSize = "small" | "medium" | "large"

/**
 * 内置按钮的 Props。
 */
export interface SchemxButtonProps extends Omit<
  ButtonHTMLAttributes,
  "disabled" | "size"
> {
  /**
   * 点击事件。
   */
  onClick?: (event: MouseEvent) => void
  /**
   * 是否显示加载状态。加载时按钮不可点击。
   */
  loading?: boolean
  /**
   * 加载状态下替换按钮内容的文本。
   */
  loadingText?: string
  /**
   * 是否禁用按钮。
   */
  disabled?: boolean
  /**
   * 按钮尺寸。
   */
  size?: SchemxButtonSize
}
