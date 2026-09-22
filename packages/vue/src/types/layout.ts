/**
 * Vue 层使用的 Row、Col 组件类型与布局配置。
 *
 * Vue 层负责将布局元数据映射到具体的组件。
 *
 * @module types/layout
 */

import type { Component } from "vue"

import type { SchemxConfig, Values } from "@schemx/core"

/**
 * Vue 框架层的 Col 配置扩展点。
 *
 * Core 只负责保留 Schema 元数据；Col 的公共布局语义由 Vue 层定义，UI 适配包可通过
 * 声明合并追加组件库专属字段。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxColDefinition<TValues extends Values = Values> {
  /** 节点占据的 24 栅格列数。 */
  span?: number

  /** 节点左侧偏移的 24 栅格列数。 */
  offset?: number

  /** 节点是否独占当前布局行。 */
  block?: boolean
}

/**
 * Row 的四边间距配置，采用 CSS padding shorthand 语义，数值单位为 px。
 *
 * 单值表示四边；二元组表示上下、左右；四元组表示上、右、下、左。
 */
export type SchemxGutter =
  number | readonly [number, number] | readonly [number, number, number, number]

/**
 * Vue 框架层的 Row 配置扩展点。
 *
 * UI 适配包通过声明合并追加自己的布局属性；内置 Row 只消费这里定义的公共字段。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxRowDefinition<TValues extends Values = Values> {
  /** Row 四边的内边距，采用 CSS padding shorthand 语义。 */
  gutter?: SchemxGutter

  /** Row 子项的水平排列方式。 */
  justify?: "start" | "end" | "center" | "space-around" | "space-between" | "space-evenly"

  /** Row 子项的垂直排列方式。 */
  align?: "top" | "middle" | "bottom"
}

/** Vue Field 使用的 Col 配置。 */
export type SchemxColConfig<TValues extends Values = Values> =
  SchemxColDefinition<TValues>

/** Vue Form、Group 和 Dynamic 使用的 Row 配置。 */
export type SchemxRowConfig<TValues extends Values = Values> =
  SchemxRowDefinition<TValues>

/**
 * 旧版字段布局配置。
 *
 * @deprecated 请改用 {@link SchemxColConfig} 与 Schema 的 `col` 字段。
 */
export type SchemxLayout<TValues extends Values = Values> = SchemxColConfig<TValues>

/**
 * Vue 层旧版 Col 配置类型。
 *
 * @deprecated 请改用 {@link SchemxColConfig}。
 */
export type SchemxVueLayout = SchemxColConfig

/**
 * Vue 层旧版配置类型。
 *
 * @deprecated 请改用 {@link SchemxConfig}。
 */
export type SchemxVueConfig<TValues extends Values = Values> = SchemxConfig<TValues>

/**
 * UI 组件库 Col 组件的 Vue 组件类型。
 */
export type SchemxColComponent = Component

/**
 * UI 组件库 Row 组件的 Vue 组件类型。
 */
export type SchemxRowComponent = Component

/**
 * Col 包装组件属性。
 *
 * 普通调用方通常只需提供 `col`，组件会从当前 Form 配置解析 UI 组件实现。
 */
export interface SchemxColProps {
  /**
   * 当前 Field 的静态 Col 配置。
   */
  col?: SchemxColConfig
  /**
   * 旧版 Col 实现覆写入口。
   *
   * @deprecated 请在 Form 或 ConfigProvider 的 `colComponent` 中配置实现，见 {@link SchemxConfig}。
   */
  component?: SchemxColComponent
  /**
   * 当前 Schema 的旧静态布局元数据。
   *
   * @deprecated 请改用 {@link SchemxColProps.col}。
   */
  layout?: SchemxLayout
}

/**
 * Row 包装组件属性。
 */
export interface SchemxRowProps {
  /**
   * 当前 Row 的配置，会透传给已注册的 UI Row 组件。
   */
  row?: SchemxRowConfig
  /**
   * 是否渲染 Row；关闭时直接透传默认插槽内容。
   */
  enabled?: boolean
}
