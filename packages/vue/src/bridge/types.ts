/**
 * Vue Bridge 的公共类型与内部生命周期类型。
 *
 * @module vue/bridge/types
 */

import type { ShallowRef } from "vue"

import type { FieldValue, NamePath, SchemxInstance, Values } from "@schemx/core"
import type { FieldSnapshotSource, FormStateAdapter } from "@schemx/core/adapter"

/**
 * 可在 Vue effect 中直接读取 Form 方法的结构兼容实例类型。
 *
 * Facade 与 Core Form 不同一引用，但保留完整的 `SchemxInstance` API。
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

/**
 * Vue 中单个字段状态的 Ref 投影。
 *
 * @typeParam TValues - Form 的值类型。
 * @typeParam TName - 字段路径类型。
 */
export interface VueFieldBridge<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 对应的 Core 字段快照来源。
   */
  readonly source: FieldSnapshotSource<TValues, TName>
  /**
   * 当前字段值。
   */
  readonly value: ShallowRef<FieldValue<TValues, TName> | undefined>
  /**
   * 当前字段错误消息。
   */
  readonly errors: ShallowRef<readonly string[]>
  /**
   * 当前字段 touched 状态。
   */
  readonly touched: ShallowRef<boolean>
  /**
   * 当前字段 pending 状态。
   */
  readonly pending: ShallowRef<boolean>
}

/**
 * 包含唯一 Vue Facade 的共享 Form Bridge。
 *
 * @typeParam TValues - Form 的值类型。
 */
export interface VueFormBridge<TValues extends Values = Values> {
  /**
   * 原始 Core Form。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 该 Form 的 Core 状态适配器。
   */
  readonly stateAdapter: FormStateAdapter<TValues>
  /**
   * 全表值 Ref。
   */
  readonly values: ShallowRef<TValues>
  /**
   * 已 touched 字段 Ref。
   */
  readonly touchedFields: ShallowRef<readonly NamePath<TValues>[]>
  /**
   * pending 字段 Ref。
   */
  readonly pendingFields: ShallowRef<PendingFieldsSnapshot<TValues>>
  /**
   * 当前表单提交状态的 Vue Ref 投影。
   */
  readonly loading: ShallowRef<boolean>
  /**
   * 按字段快照来源身份缓存的字段 Ref 投影。
   */
  readonly fieldBridges: Map<object, ManagedVueFieldBridge<TValues>>
  /**
   * 正在使用当前 Bridge 的 Vue owner 数量。
   */
  refCount: number
  /**
   * Bridge 是否已被手动或自动释放。
   */
  destroyed: boolean
  /**
   * 取消 Form 级状态适配器订阅。
   */
  readonly unsubscribe: () => void
  /**
   * 与原始 Core Form 对应的唯一 Vue Facade。
   */
  readonly facade: VueSchemxInstance<TValues>
}

/**
 * 内部使用的、可停止订阅的字段 Ref 投影。
 *
 * @internal
 * @typeParam TValues - Form 的值类型。
 */
export interface ManagedVueFieldBridge<
  TValues extends Values,
> extends VueFieldBridge<TValues> {
  /**
   * 停止字段快照到 Vue Ref 的同步订阅。
   */
  dispose(): void
}
