/**
 * Vue Runtime 的内部状态类型。
 *
 * 公开层只保留 `VueSchemxInstance`；Runtime 和各类 State 均由 bridge
 * 内部统一管理，不向消费端暴露缓存或生命周期细节。
 *
 * @module vue/bridge/types
 */

import type { ComputedRef, ShallowRef } from "vue"

import type {
  FieldValue,
  NamePath,
  SchemxInstance,
  SchemxViewSchema,
  Values,
} from "@schemx/core"
import type { FormStateAdapter } from "@schemx/core/adapter"

/**
 * 可在 Vue effect 中直接读取 Form 方法的结构兼容实例类型。
 *
 * Instance 与 Core Form 不是同一引用，但保留完整的 `SchemxInstance` API。
 *
 * @typeParam TValues - Form 的值类型。
 */
export type VueSchemxInstance<TValues extends Values = Values> = SchemxInstance<TValues>

/**
 * FormStateAdapter 中 pending 字段的只读聚合快照。
 *
 * @typeParam TValues - Form 的值类型。
 */
export type PendingFieldsSnapshot<TValues extends Values> = readonly ReturnType<
  SchemxInstance<TValues>["getPendingFields"]
>[number][]

/** Vue 中单个字段状态的 Ref 投影。 */
export interface VueFieldState<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly value: ShallowRef<FieldValue<TValues, TName> | undefined>
  readonly errors: ShallowRef<readonly string[]>
  readonly touched: ShallowRef<boolean>
  readonly pending: ShallowRef<boolean>
}

/** Vue 中 ViewSchema 列表及其索引的共享投影。 */
export interface VueViewSchemaState<TValues extends Values = Values> {
  readonly schemasByKey: ComputedRef<ReadonlyMap<string, SchemxViewSchema<TValues>>>
  readonly viewSchemas: ShallowRef<readonly SchemxViewSchema<TValues>[]>
  dispose(): void
}

/**
 * 一个 Runtime 当前激活的响应式资源。
 *
 * 资源在首个 owner acquire 时创建，在最后一个 owner release 时释放；
 * Runtime 和 Instance 外壳本身保持稳定，以保证 Instance 身份不变。
 */
export interface VueFormResources<TValues extends Values> {
  readonly stateAdapter: FormStateAdapter<TValues>
  readonly values: ShallowRef<TValues>
  readonly touchedFields: ShallowRef<readonly NamePath<TValues>[]>
  readonly pendingFields: ShallowRef<PendingFieldsSnapshot<TValues>>
  readonly loading: ShallowRef<boolean>
  readonly fieldStates: Map<object, VueFieldState<TValues>>
  viewSchemaState?: VueViewSchemaState<TValues>
  dispose(): void
}

/** Instance 需要追踪的字段级 Vue 依赖。 */
export type VueFieldDependency = "value" | "errors" | "touched" | "pending"

/** Instance 需要追踪的 Form 级 Vue 依赖。 */
export type VueFormDependency = "values" | "touchedFields" | "pendingFields" | "loading"

/**
 * 每个 Core Form 唯一的 Vue Runtime。
 *
 * Runtime 是 bridge 内部唯一的聚合边界；外部 Hook 不再接触 Adapter、Map
 * 或引用计数，只通过下列状态读取和投影方法消费资源。
 */
export interface VueFormRuntime<TValues extends Values = Values> {
  readonly core: SchemxInstance<TValues>
  readonly instance: VueSchemxInstance<TValues>
  retain(): () => void
  trackField<TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void
  trackFieldsValue(names?: NamePath<TValues>[]): void
  trackForm(dependency: VueFormDependency): void
  getValuesRef(): ShallowRef<TValues>
  getFieldState<TName extends NamePath<TValues>>(
    name: TName
  ): VueFieldState<TValues, TName>
  getViewSchemaState(): VueViewSchemaState<TValues>
  destroy(): void
}
