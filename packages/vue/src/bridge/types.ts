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
  VueBoundFieldState,
  VueFieldState,
  VueStateBridge,
  VueStateRef,
} from "./index"
import type { SchemxInstance as VueInstance } from "../types"
import type {
  NamePath,
  SchemxFieldInstance,
  SchemxInstance,
  SchemxViewSchema,
  Values,
} from "@schemx/core"

// 统一转出原生字段状态的 Vue 投影类型。
export type { VueFieldState } from "./index"

/**
 * Vue 可追踪的表单实例旧类型名。
 *
 * @typeParam TValues - 表单值类型。
 * @deprecated 请改用 {@link SchemxInstance}。
 */
export type VueSchemxInstance<TValues extends Values = Values> = VueInstance<TValues>

/**
 * Core 原生 pending 字段的只读聚合快照。
 *
 * @typeParam TValues - Form 的值类型。
 */
export type PendingFieldsSnapshot<TValues extends Values> = readonly ReturnType<
  SchemxInstance<TValues>["getPendingFields"]
>[number][]

/**
 * Vue 中 ViewSchema 列表及其索引的共享投影。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface VueViewSchemaState<TValues extends Values = Values> {
  /**
   * 按当前 Schema key 查找顶层或嵌套节点的计算索引。
   * 数组移动后路径 key 可能变化；组件身份仍应由 nodeId 表达。
   */
  readonly schemasByKey: ComputedRef<ReadonlyMap<string, SchemxViewSchema<TValues>>>
  /**
   * 当前 Form 的完整 ViewSchema 列表。
   */
  readonly viewSchemas: ShallowRef<readonly SchemxViewSchema<TValues>[]>
  /**
   * 取消 ViewSchema 订阅并释放该状态投影。
   * 已取得的 Ref 保留最后一次列表值，重复调用无副作用。
   * @example state.dispose()
   */
  dispose(): void
}

/**
 * 一个 Runtime 当前激活的响应式资源。
 *
 * retain 激活共享缓存，具体状态首次读取时订阅，最后一个 owner release 时释放；
 * Runtime 和 Instance 外壳本身保持稳定，以保证 Instance 身份不变。
 * @typeParam TValues - 表单值类型。
 */
export interface VueFormResources<TValues extends Values> {
  /**
   * 原生状态的唯一 Vue 绑定与订阅回收入口。
   */
  readonly states: VueStateBridge
  /**
   * 按需创建的 ViewSchema 状态投影。
   */
  viewSchemaState?: VueViewSchemaState<TValues>
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
 * @typeParam TValues - 表单值类型。
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
  readonly instance: VueInstance<TValues>
  /**
   * 增加一个资源 owner，并返回幂等的释放函数；最后一个 owner 释放时回收投影。
   * Runtime 已销毁时返回空操作，不能借此重新激活资源。
   * @example const release = runtime.retain(); release()
   */
  retain(): () => void
  /**
   * 在当前 Vue effect 中追踪指定字段状态。
   * 不激活已释放资源；需要先通过 retain 或获取方法建立资源周期。
   * @typeParam TName - 当前查询的字段路径。
   * @param name - 需要追踪的字段路径。
   * @param dependency - 本次读取的字段状态种类。
   * @example runtime.trackField("name", "errors")
   */
  trackField<TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void
  /**
   * 在当前 Vue effect 中追踪指定字段或完整表单值。
   * @param names - 需要追踪的路径；省略时追踪整表，空数组不追踪字段。
   * @example runtime.trackFieldsValue(["name"])
   */
  trackFieldsValue(names?: NamePath<TValues>[]): void
  /**
   * 在当前 Vue effect 中追踪 Form 级聚合状态。
   * @param dependency - 本次读取的表单聚合状态种类。
   * @example runtime.trackForm("loading")
   */
  trackForm(dependency: VueFormDependency): void
  /**
   * 获取完整表单值的共享 Vue Ref。
   * 按需激活资源；Runtime 已销毁时抛出错误。
   * @example const values = runtime.getValuesRef()
   */
  getValuesRef(): VueStateRef<TValues>
  /**
   * 获取指定路径的共享 Vue 状态投影，跟随该路径当前的字段值。
   * @typeParam TName - 当前查询的字段路径。
   * @param name - 要投影的固定字段路径。
   * @example const state = runtime.getFieldState("name")
   */
  getFieldState<TName extends NamePath<TValues>>(
    name: TName
  ): VueFieldState<TValues, TName>
  /**
   * 获取已绑定字段的身份投影，不重新定位同名节点。
   * @typeParam TName - 控制器的初始字段路径。
   * @param field - Core 缓存的字段控制器。
   * @example const state = runtime.getBoundFieldState(controller)
   */
  getBoundFieldState<TName extends NamePath<TValues>>(
    field: SchemxFieldInstance<TValues, TName>
  ): VueBoundFieldState<TValues, TName>
  /**
   * 获取当前 Form 的共享 ViewSchema 状态投影。
   * 首次读取时创建订阅，与当前资源周期一起释放。
   * @example const schemas = runtime.getViewSchemaState().viewSchemas
   */
  getViewSchemaState(): VueViewSchemaState<TValues>
  /**
   * 永久关闭 Runtime 并释放响应式资源，不直接销毁 Core Form。
   * 通常由 Vue Instance.destroy 调用；owner 释放后需要复用时不应调用此方法。
   * @example runtime.destroy()
   */
  destroy(): void
}
