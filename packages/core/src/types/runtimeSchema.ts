/**
 * Runtime Schema 类型。
 *
 * 公共 Schema 输入会按字段名分发，以便为消费端提供精确上下文；Runtime 不需要这层
 * 关联，使用宽结构可以避免字段路径联合扩散到 Compiler 和 Reconciler。
 *
 * @module types/runtimeSchema
 */

import type {
  SchemxDependencyField,
  SchemxDependencyRendererContext,
} from "./dependency"
import type { SchemxDynamicField } from "./dynamic"
import type { SchemxBaseField } from "./field"
import type { Values } from "./form"
import type { SchemxGroupField } from "./group"
import type { SchemxFormApi } from "./instance"

/** Runtime 中使用的普通字段结构。 */
export type SchemxRuntimeField<TValues extends Values = Values> = SchemxBaseField<TValues>

/** Runtime Group 结构，子节点继续使用宽 Runtime Schema。 */
export type SchemxRuntimeGroup<TValues extends Values = Values> = Omit<
  SchemxGroupField<TValues>,
  "children"
> & {
  children: SchemxRuntimeSchema<TValues>[]
}

/** Runtime Dependency 结构，renderer 返回宽 Runtime Schema。 */
export type SchemxRuntimeDependency<TValues extends Values = Values> = Omit<
  SchemxDependencyField<TValues>,
  "renderer"
> & {
  renderer: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: SchemxDependencyRendererContext
  ) => SchemxRuntimeSchema<TValues>[] | Promise<SchemxRuntimeSchema<TValues>[]>
}

/** Runtime Dynamic 结构，行模板在 Runtime 中按宽 Schema 处理。 */
export type SchemxRuntimeDynamic<TValues extends Values = Values> = Omit<
  SchemxDynamicField<TValues>,
  "item"
> & {
  item: SchemxRuntimeSchema<TValues>[]
}

/** Runtime 使用的宽 Schema 联合。 */
export type SchemxRuntimeSchema<TValues extends Values = Values> =
  | SchemxRuntimeField<TValues>
  | SchemxRuntimeGroup<TValues>
  | SchemxRuntimeDependency<TValues>
  | SchemxRuntimeDynamic<TValues>
