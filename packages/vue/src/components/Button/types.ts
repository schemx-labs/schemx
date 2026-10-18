/**
 * 内置 Button 组件的公开类型。
 *
 * @module components/Button/types
 */

import type { ButtonHTMLAttributes, Component } from "vue"

/**
 * 接收 SchemxButtonProps 和按钮插槽的 Vue 按钮组件实现。
 */
export type SchemxButtonComponent = Component

/**
 * 内置按钮的尺寸。
 */
export type SchemxButtonSize = "small" | "medium" | "large"

/**
 * 按钮包装层统一管理的交互状态，不包含 UI 库专属的外观属性。
 */
export interface SchemxButtonOptions {
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
}

/**
 * 内部按钮的外观配置与原生行为。
 */
export interface SchemxDefaultButtonOptions extends SchemxButtonOptions {
  /**
   * 内部按钮尺寸，默认 medium。
   */
  size?: SchemxButtonSize
  /**
   * 内部按钮外观；未配置时提交按钮突出显示，其余使用默认外观。
   */
  type?: "default" | "primary"
  /**
   * 原生按钮行为，默认 button。
   */
  nativeType?: "button" | "submit" | "reset"
}

/**
 * 按钮属性扩展点；UI 适配包通过声明合并继承各自的 ButtonProps。
 */
export interface SchemxButtonDefinition {}

// 适配包已声明的属性沿用其类型，否则使用内部按钮的公共配置。
type SchemxButtonDefinitionValue<
  TKey extends PropertyKey,
  TDefault,
> = TKey extends keyof SchemxButtonDefinition
  ? SchemxButtonDefinition[Extract<TKey, keyof SchemxButtonDefinition>]
  : TDefault

/**
 * 按钮公共属性，直接继承适配包扩展，并补充 HTML 属性及内部实现的缺省类型。
 */
export interface SchemxButtonProps
  extends
    SchemxButtonDefinition,
    SchemxButtonOptions,
    Omit<
      ButtonHTMLAttributes,
      keyof SchemxButtonDefinition | "disabled" | "size" | "type"
    > {
  /**
   * 外观类型；导入 UI 适配包后沿用对应按钮的类型。
   */
  type?: SchemxButtonDefinitionValue<"type", SchemxDefaultButtonOptions["type"]>
  /**
   * 按钮尺寸；未导入 UI 适配包时使用内部尺寸。
   */
  size?: SchemxButtonDefinitionValue<"size", SchemxButtonSize>
  /**
   * 原生按钮行为，操作区会固定为 button。
   */
  nativeType?: SchemxButtonDefinitionValue<
    "nativeType",
    SchemxDefaultButtonOptions["nativeType"]
  >
  /**
   * 点击事件。
   */
  onClick?: (event: MouseEvent) => void
}
