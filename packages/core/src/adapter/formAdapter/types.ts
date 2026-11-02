import type { ResolvedFormConfig } from "../../config"
import type { ReadonlyState } from "../../reactivity"
import type { FieldState, StorePending } from "../../store"
import type { NamePath, SchemxInstance, Values } from "../../types"
import type { SchemxViewSchema } from "../../view"

/**
 * Form 原生只读状态的统一入口；不管理框架容器、共享订阅或 owner。
 * subscribe 直接使用 Core Signal 通知，首次同步交付当前值；消费者自行取消订阅。
 * Form 销毁时释放订阅，已有状态仍可读取；ViewSchema 沿用原有防抖通知。
 * @typeParam TValues - 所属表单值类型。
 */
export interface FormAdapter<TValues extends Values> {
  /**
   * 原始 Form，字段命令、校验和销毁仍通过它执行。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * Store 原生整表值，按身份直接复用。
   */
  readonly values: ReadonlyState<TValues>
  /**
   * Store 原生 touched 路径列表。
   */
  readonly touchedFields: ReadonlyState<readonly NamePath<TValues>[]>
  /**
   * Store 原生 pending 字段列表。
   */
  readonly pendingFields: ReadonlyState<
    readonly StorePending<TValues, NamePath<TValues>>[]
  >
  /**
   * 配置模型持有的原生生效配置。
   */
  readonly config: ReadonlyState<ResolvedFormConfig<TValues>>
  /**
   * Form 原生提交状态的只读视图。
   */
  readonly loading: ReadonlyState<boolean>
  /**
   * Form 原生销毁状态的只读视图。
   */
  readonly disposed: ReadonlyState<boolean>
  /**
   * 当前最终 ViewSchema，subscribe 保留原有首值和防抖语义。
   */
  readonly viewSchemas: ReadonlyState<readonly SchemxViewSchema<TValues>[]>
  /**
   * 获取 Store 已持有的固定路径状态，不跟随节点移动。
   * @typeParam TName - 固定字段路径。
   * @param name - 需要消费的业务字段路径。
   * @throws Form 已销毁时抛出错误。
   * @example const state = adapter.field("name")
   */
  field<TName extends NamePath<TValues>>(name: TName): FieldState<TValues, TName>
}
