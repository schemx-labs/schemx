/**
 * Vue 层使用的 Col 组件类型与布局配置。
 *
 * Core 只定义 {@link SchemxLayout} 元数据；Vue 层负责将其映射到具体的组件。
 *
 * @module types/layout
 */

import type { Component } from "vue"

import type { SchemxConfig, SchemxLayout, Values } from "@schemx/core"

/** UI 组件库 Col 组件的 Vue 组件类型。 */
export type SchemxColComponent = Component

/**
 * Col 包装组件属性。
 *
 * `component` 仅供 Schemx 内部把 Form 解析出的实现传给 Col；普通调用方通常只需
 * 提供 `layout`，组件会从显式组件属性或全局注册表解析实现。
 */
export interface SchemxColProps {
  /** 当前 Schema 的静态布局元数据。 */
  layout?: SchemxLayout
  /** 当前 Form 解析出的 Col 实现。 */
  component?: SchemxColComponent
}

/**
 * Vue 适配层配置。
 *
 * Core 配置保持框架无关；`colComponent` 仅供 Vue 渲染层解析布局组件。
 */
export interface SchemxVueConfig<
  TValues extends Values = Values,
> extends SchemxConfig<TValues> {
  /** 当前 App、Provider 或 Form 使用的 Col 实现。 */
  readonly colComponent?: SchemxColComponent
}
