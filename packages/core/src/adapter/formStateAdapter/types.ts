/**
 * Form 状态适配器的只读快照订阅协议。
 *
 * @module core/adapter/formStateAdapter/types
 */

import type { ResolvedFormConfig } from "../../config"
import type { ReadonlyState } from "../../reactivity"
import type { StorePending } from "../../store"
import type { FieldRef } from "../../types"
import type {
  DeepReadonly,
  FieldValue,
  NamePath,
  SchemxInstance,
  Values,
} from "../../types"
import type { SchemxViewSchema } from "../../view"

/**
 * 可被 UI 框架消费的同步快照来源。
 *
 * 状态由 Core 持有；快照直接复用只读状态引用，不能通过该协议写入状态。
 *
 * @typeParam TSnapshot - 该来源提供的快照类型。
 *
 * @example
 * ```ts
 * const unsubscribe = source.subscribe(() => {
 *   console.log(source.getSnapshot())
 * })
 *
 * unsubscribe()
 * ```
 */
export interface SnapshotSource<TSnapshot> {
  /**
   * 无依赖读取当前只读快照；状态未变化时保持同一引用。
   * 适配器释放后仍读取原生状态，不保留已过期的快照。
   */
  getSnapshot(): DeepReadonly<TSnapshot>
  /**
   * 注册独立的状态变化监听；首次订阅不通知，后续仅在快照变化时通知。
   *
   * @param listener - 快照发生真实变化时调用的监听函数。
   * @returns 可重复调用的取消订阅函数。
   */
  subscribe(listener: () => void): () => void
}

/**
 * 单字段的聚合状态快照。
 *
 * @typeParam TValues - 所属表单的值类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FieldStateSnapshot<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 当前字段值；字段尚未注册或没有值时可能为 `undefined`。
   */
  readonly value: FieldValue<TValues, TName> | undefined
  /**
   * 当前字段错误消息。
   */
  readonly errors: readonly string[]
  /**
   * 字段是否已被触碰。
   */
  readonly touched: boolean
  /**
   * 字段是否处于 pending 状态。
   */
  readonly pending: boolean
}

/**
 * 为单个字段提供聚合状态快照的来源。
 *
 * @typeParam TValues - 所属表单的值类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FieldSnapshotSource<
  TValues extends Values,
  TName extends NamePath<TValues>,
> extends SnapshotSource<FieldStateSnapshot<TValues, TName>> {
  /**
   * 当前字段值的独立来源。
   */
  readonly value: SnapshotSource<FieldValue<TValues, TName> | undefined>
  /**
   * 错误消息的独立来源。
   */
  readonly errors: SnapshotSource<readonly string[]>
  /**
   * 触摸状态的独立来源。
   */
  readonly touched: SnapshotSource<boolean>
  /**
   * 操作状态的独立来源。
   */
  readonly pending: SnapshotSource<boolean>
}

/**
 * 跟随稳定字段引用的状态来源；失效后值为空、错误为空且交互状态为 false。
 * @typeParam TValues - 所属表单的值类型。
 * @typeParam TName - 引用初始字段路径。
 */
export interface FieldRefSnapshotSource<
  TValues extends Values,
  TName extends NamePath<TValues>,
> extends FieldSnapshotSource<TValues, TName> {
  /**
   * 当前路径，失效后为 undefined。
   */
  readonly name: SnapshotSource<NamePath<TValues> | undefined>
  /**
   * 引用所属节点或表单是否已销毁。
   */
  readonly disposed: SnapshotSource<boolean>
}

/**
 * 一个 Form 的状态适配器。
 *
 * 适配器不拥有也不会销毁原始 Form；`dispose()` 只释放该适配器创建的订阅和字段缓存。
 *
 * @typeParam TValues - Form 的值类型。
 *
 * @example
 * ```ts
 * const adapter = createFormStateAdapter(form)
 * const unsubscribe = adapter.values.subscribe(() => {
 *   console.log(adapter.values.getSnapshot())
 * })
 *
 * unsubscribe()
 * adapter.dispose()
 * ```
 */
export interface FormStateAdapter<TValues extends Values> {
  /**
   * 适配器对应的原始 Core Form。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 全表值快照来源。
   */
  readonly values: SnapshotSource<TValues>
  /**
   * 已 touched 字段路径快照来源，顺序与原生状态一致。
   */
  readonly touchedFields: SnapshotSource<readonly NamePath<TValues>[]>
  /**
   * pending 字段及其消息快照来源，顺序与原生状态一致。
   */
  readonly pendingFields: SnapshotSource<
    readonly StorePending<TValues, NamePath<TValues>>[]
  >
  /**
   * 当前是否正在执行提交流程。
   */
  readonly loading: SnapshotSource<boolean>
  /**
   * 当前生效的运行期配置。
   */
  readonly config: SnapshotSource<ResolvedFormConfig<TValues>>
  /**
   * 原始表单是否已销毁；不表示 adapter 是否已释放。
   */
  readonly disposed: SnapshotSource<boolean>
  /**
   * 视图列表来源，保留 Core 现有的防抖通知策略。
   */
  readonly viewSchemas: SnapshotSource<readonly SchemxViewSchema<TValues>[]>
  /**
   * 转换任意原生状态，复用同一状态身份对应的来源。
   * @typeParam TValue - 原生状态的值类型。
   * @param state - 当前表单或字段提供的原生只读状态。
   * @throws 适配器已经释放时抛出错误。
   * @example const source = adapter.bind(form.getFieldState(form.getFieldRef("name")).value)
   */
  bind<TValue>(state: ReadonlyState<TValue>): SnapshotSource<TValue>
  /**
   * 按稳定引用读取字段，节点移动和失效语义由 Form 统一处理。
   * @typeParam TName - 控制器初始路径，用于保留值类型。
   * @param ref - 当前表单创建的字段引用。
   * @example const field = adapter.field(form.getFieldRef("name"))
   */
  field<TName extends NamePath<TValues>>(
    ref: FieldRef<TValues, TName>
  ): FieldRefSnapshotSource<TValues, TName>
  /**
   * 复用同一路径状态对应的字段快照来源；节点移动不改变此来源的目标路径。
   *
   * @param name - 要读取的字段路径。
   * @returns 对应字段的稳定快照来源。
   * @throws 适配器已经释放时抛出错误。
   */
  field<TName extends NamePath<TValues>>(name: TName): FieldSnapshotSource<TValues, TName>
  /**
   * 停止此适配器的全部订阅，清空字段来源包装，并禁止新增订阅。
   *
   * 此操作不会销毁原始 Form 或冻结已取得来源的快照读取，并且可以重复调用。
   */
  dispose(): void
}
