/**
 * Vue 层 Icon 组件与图标值契约。
 *
 * @module types/icon
 */

import type { Component } from "vue"

/** UI 适配层提供的 Icon Adapter 组件。 */
export type SchemxIconComponent = Component

/** 字段可使用的图标名称或 Vue 图标组件。 */
export type SchemxIconValue = string | Component

/**
 * Icon 包装组件 Props。
 */
export interface SchemxIconProps {
  /** 当前图标名称或直接使用的 Vue 组件。 */
  icon: SchemxIconValue
  /** 处理字符串图标名称的 Icon Adapter。 */
  component?: SchemxIconComponent
}
