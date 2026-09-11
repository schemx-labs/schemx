/**
 * 分组字段类型定义
 *
 * 定义 Group Schema 及其编译后的静态类型。
 *
 * @module types/group
 */

// 有意保留声明合并能力，以支持 Group 专属的扩展接口。
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { SchemxGroupDependencies } from "./dependencies"
import type { Values } from "./form"
import type { SchemxLayout } from "./layout"
import type { SchemxField } from "./schema"

/**
 * 自定义 Group Schema 基础字段扩展接口
 *
 * 空接口占位，供业务方通过 TypeScript 声明合并（declaration merging）
 * 向 {@link SchemxBase} 注入额外的自定义字段。
 *
 * @example
 * ```ts
 * declare module '@schemx/core' {
 *   interface SchemxGroupFieldDefinition {
 *     tooltip?: string
 *     span?: number
 *   }
 * }
 * ```
 *
 * 扩展属性会作为静态 Schema 元数据保留，并透传到 Group ViewSchema；
 * 声明扩展属性不会自动增加 dependencies 可动态覆盖的属性。
 */
export interface SchemxGroupFieldDefinition {}

/**
 * 分组字段配置
 *
 * 将多个字段组织为可折叠的分组，通过 `children` 与普通字段区分。
 *
 * @typeParam  TValues - 表单值类型
 */
export interface SchemxGroupField<
  TValues extends Values = Values,
> extends SchemxGroupFieldDefinition {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string
  /**
   * 分组标签
   *
   * @deprecated Group 展示配置由 UI 适配层拥有；兼容期间仍保留。
   */
  label: string
  /**
   * 分组内的列配置
   */
  children: SchemxField<TValues>[]

  /**
   * Group 在 24 栅格布局容器中的静态布局配置。
   *
   * Core 会将该配置透传到 Group ViewSchema；具体的布局组件由适配层解释。
   *
   * @deprecated 请从 UI 适配层使用 Group 布局定义。
   */
  layout?: SchemxLayout

  /**
   * 是否可见。
   *
   * 不可见时整个后代子树停止校验，但保留字段值。
   */
  visible?: boolean
  /**
   * 是否强制后代字段只读。
   */
  readonly?: boolean
  /**
   * 是否强制后代字段禁用。
   */
  disabled?: boolean
  /**
   * 根据表单值动态覆盖 Group 的容器状态。
   */
  dependencies?: SchemxGroupDependencies<TValues>
  /**
   * 是否可折叠
   *
   * @deprecated Group 交互配置由 UI 适配层拥有；兼容期间仍保留。
   */
  collapsible?: boolean
  /**
   * 默认是否折叠
   *
   * @deprecated Group 交互配置由 UI 适配层拥有；兼容期间仍保留。
   */
  defaultCollapsed?: boolean
  /**
   * 受控折叠状态。
   *
   * @deprecated Group 交互配置由 UI 适配层拥有；兼容期间仍保留。
   */
  collapsed?: boolean
  /**
   * 用户切换折叠状态后的回调。
   *
   * @deprecated Group 交互配置由 UI 适配层拥有；兼容期间仍保留。
   */
  onCollapsedChange?: (collapsed: boolean) => void
  /**
   * 折叠时是否卸载后代 Renderer，默认保持现有行为 `true`。
   *
   * @deprecated Group 交互配置由 UI 适配层拥有；兼容期间仍保留。
   */
  destroyOnCollapse?: boolean
}
