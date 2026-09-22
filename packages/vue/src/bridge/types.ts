/**
 * Vue Runtime 的内部状态类型。
 *
 * Runtime 和各类 State 均由 bridge 内部统一管理，不向消费端暴露缓存或
 * 生命周期细节。
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
 * Vue 可追踪的表单实例旧类型名。
 *
 * @deprecated 请改用 {@link SchemxInstance}。
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

/**
 * Vue 中单个字段状态的 Ref 投影。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 */
export interface VueFieldState<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 当前字段值。
   */
  readonly value: ShallowRef<FieldValue<TValues, TName> | undefined>
  /**
   * 当前字段的校验错误列表。
   */
  readonly errors: ShallowRef<readonly string[]>
  /**
   * 当前字段是否已被触碰。
   */
  readonly touched: ShallowRef<boolean>
  /**
   * 当前字段是否存在进行中的异步操作。
   */
  readonly pending: ShallowRef<boolean>
}

/**
 * Vue 中 ViewSchema 列表及其索引的共享投影。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface VueViewSchemaState<TValues extends Values = Values> {
  /**
   * 按稳定 key 查找顶层或嵌套 ViewSchema 的计算索引。
   */
  readonly schemasByKey: ComputedRef<ReadonlyMap<string, SchemxViewSchema<TValues>>>
  /**
   * 当前 Form 的完整 ViewSchema 列表。
   */
  readonly viewSchemas: ShallowRef<readonly SchemxViewSchema<TValues>[]>
  /**
   * 取消 ViewSchema 订阅并释放该状态投影。
   */
  dispose(): void
}

/**
 * 一个 Runtime 当前激活的响应式资源。
 *
 * 资源在首个 owner acquire 时创建，在最后一个 owner release 时释放；
 * Runtime 和 Instance 外壳本身保持稳定，以保证 Instance 身份不变。
 */
export interface VueFormResources<TValues extends Values> {
  /**
   * Core Form 的状态适配器。
   */
  readonly stateAdapter: FormStateAdapter<TValues>
  /**
   * 完整表单值快照。
   */
  readonly values: ShallowRef<TValues>
  /**
   * 已触碰字段路径快照。
   */
  readonly touchedFields: ShallowRef<readonly NamePath<TValues>[]>
  /**
   * 正在进行异步操作的字段快照。
   */
  readonly pendingFields: ShallowRef<PendingFieldsSnapshot<TValues>>
  /**
   * Form 级提交或加载状态。
   */
  readonly loading: ShallowRef<boolean>
  /**
   * 按 SnapshotSource 身份缓存的字段状态。
   */
  readonly fieldStates: Map<object, VueFieldState<TValues>>
  /**
   * 按需创建的 ViewSchema 状态投影。
   */
  viewSchemaState?: VueViewSchemaState<TValues>
  /**
   * 释放所有状态订阅和缓存。
   */
  dispose(): void
}

/**
 * Instance 需要追踪的字段级 Vue 依赖。
 */
export type VueFieldDependency = "value" | "errors" | "touched" | "pending"

/**
 * Instance 需要追踪的 Form 级 Vue 依赖。
 */
export type VueFormDependency = "values" | "touchedFields" | "pendingFields" | "loading"

/**
 * 每个 Core Form 唯一的 Vue Runtime。
 *
 * Runtime 是 bridge 内部唯一的聚合边界；外部 Hook 不再接触 Adapter、Map
 * 或引用计数，只通过下列状态读取和投影方法消费资源。
 */
export interface VueFormRuntime<TValues extends Values = Values> {
  /**
   * 原始 Core Form 实例。
   *
   * @deprecated 请使用 {@link VueFormRuntime.instance}；该字段仅为兼容旧版 Runtime 消费者保留。
   */
  readonly core: SchemxInstance<TValues>
  /**
   * 对外提供的 Vue 响应式 Form Instance。
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * 增加一个资源 owner，并返回对应的释放函数。
   */
  retain(): () => void
  /**
   * 在当前 Vue effect 中追踪指定字段状态。
   */
  trackField<TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void
  /**
   * 在当前 Vue effect 中追踪指定字段或完整表单值。
   */
  trackFieldsValue(names?: NamePath<TValues>[]): void
  /**
   * 在当前 Vue effect 中追踪 Form 级聚合状态。
   */
  trackForm(dependency: VueFormDependency): void
  /**
   * 获取完整表单值的共享 Vue Ref。
   */
  getValuesRef(): ShallowRef<TValues>
  /**
   * 获取指定字段的共享 Vue 状态投影。
   */
  getFieldState<TName extends NamePath<TValues>>(
    name: TName
  ): VueFieldState<TValues, TName>
  /**
   * 获取当前 Form 的共享 ViewSchema 状态投影。
   */
  getViewSchemaState(): VueViewSchemaState<TValues>
  /**
   * 销毁 Runtime，并释放当前仍保留的响应式资源。
   */
  destroy(): void
}
