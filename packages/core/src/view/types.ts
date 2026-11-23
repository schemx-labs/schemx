/**
 * ViewSchema 类型定义。
 *
 * ViewSchema 是渲染层消费的 schema 快照：它保留 SchemxField 的扁平字段格式，
 * 但只包含 core 已处理好的静态渲染数据。dependency schema 会被透明展开，
 * 不会出现在最终结果中。
 *
 * @module core/view/types
 */

import type { SchemxResolvedBaseField, SchemxResolvedGroupField, Values } from "../types"

/**
 * 对联合类型逐项执行 Omit。
 *
 * TypeScript 内置的 `Omit<T, K>` 直接作用在联合类型上时会先合并成员公共属性，
 * 这里通过条件类型触发 distributive behavior，保留每个 schema 分支各自的字段。
 *
 * @typeParam T - 要处理的源类型，支持联合类型。
 * @typeParam K - 要从每个联合成员中移除的属性 key。
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * 渲染器标识。
 */
export type SchemxRendererKey = string

/**
 * ViewSchema 调试元数据。
 */
export interface SchemxViewDebugMeta {
  readonly runtimeNodeId: number
  readonly runtimeNodeType: string
  readonly hasFieldModel: boolean
  readonly hasDependencySlot: boolean
}

/**
 * 字段 ViewSchema。
 *
 * 字段项保持 SchemxField 的扁平格式，动态依赖结果已经合并为静态值。
 */
export type SchemxViewFieldSchema<TValues extends Values = Values> = DistributiveOmit<
  SchemxResolvedBaseField<TValues>,
  "key"
> & {
  readonly key: string
  readonly debug?: Readonly<SchemxViewDebugMeta>
}

/**
 * 分组 ViewSchema。
 *
 * group 继续以 children 表达结构层级，children 中不会包含 dependency schema。
 */
export type SchemxViewGroupSchema<TValues extends Values = Values> = DistributiveOmit<
  SchemxResolvedGroupField<TValues>,
  "key" | "children"
> & {
  readonly key: string
  readonly children: readonly SchemxViewSchema<TValues>[]
  readonly debug?: Readonly<SchemxViewDebugMeta>
}

/**
 * 渲染层消费的 schema 联合类型。
 */
export type SchemxViewSchema<TValues extends Values = Values> =
  | SchemxViewFieldSchema<TValues>
  | SchemxViewGroupSchema<TValues>
