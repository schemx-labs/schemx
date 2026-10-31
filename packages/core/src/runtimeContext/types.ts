/**
 * 表单运行模块的共享依赖上下文。
 *
 * 节点只通过窄端口读取 Form 拥有的状态与校验资源。
 *
 * @typeParam TValues - 表单值对象类型。
 * @module core/runtimeContext/types
 */

import type { DynamicRowState, NodeId, NodeManager } from "../node"
import type { Scheduler } from "../scheduler"
import type { Store } from "../store"
import type {
  SchemxField,
  SchemxFieldRulesMap,
  SchemxFormApi,
  SchemxInstance,
  Values,
} from "../types"
import type { Validator } from "../validator"

/**
 * Runtime 访问字段状态和初始值所需的最小 Store 能力。
 *
 * Store 按 NamePath 保存数据；Runtime 在调用端口前解析节点的当前路径。
 * @typeParam TValues - 表单值对象类型。
 */
export type RuntimeStorePort<TValues extends Values = Values> = Pick<
  Store<TValues>,
  | "registerFieldPath"
  | "unregisterFieldPath"
  | "getArrayStructureHandle"
  | "getFieldValue"
  | "getFieldSnapshot"
  | "getFieldsValue"
  | "setFieldValue"
  | "getInitialValues"
  | "getInitialValue"
  | "setInitialValue"
  | "removeFieldValue"
  | "resetField"
  | "subscribeResets"
>

/**
 * Runtime 管理字段校验所需的最小 Validator 能力。
 *
 * 配置和规则使用当前 NamePath，调度任务仍由 Runtime 的 NodeId 标识。
 * @typeParam TValues - 表单值对象类型。
 */
export type RuntimeValidationPort<TValues extends Values = Values> = Pick<
  Validator<TValues>,
  "setFieldConfig" | "setFieldRules" | "removeField" | "invalidateFieldArray"
>

/**
 * 节点挂载和更新时使用的子树协调能力。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface ChildReconciler<TValues extends Values = Values> {
  /**
   * 统一关联数组行身份、展开模板并提交行与子树。
   * @param parentId - 已挂载的 Dynamic 节点 ID。
   * @param options - Store 行 key、模板展开回调和值保留策略。
   * @example childReconciler.reconcileArray(node.id, { keys, createSchemas: expandRows })
   */
  reconcileArray(parentId: NodeId, options: ReconcileArrayOptions<TValues>): void
  /**
   * 通过统一提交边界协调指定容器的直接子节点。
   * @param parentId - 接收子节点的容器 Node id。
   * @param schemas - 新一轮原始子 schema 列表。
   * @param preserveValues - 数据已由 Store 更新时保留值，避免旧索引清理影响新占用者。
   */
  reconcileChildren(
    parentId: NodeId,
    schemas: readonly SchemxField<TValues>[],
    preserveValues?: boolean
  ): void
  /**
   * 关联已生成行内字段的新路径，保持节点身份和 Store 已移动的数据。
   * @param parentId - Dependency 节点 ID。
   * @param from - 当前行原来的身份和位置快照。
   * @param to - 同一行的新位置快照。
   */
  rebaseChildren(parentId: NodeId, from: DynamicRowState, to: DynamicRowState): void
}

/**
 * 根据当前行身份展开数组模板，不提交节点或索引。
 * @typeParam TValues - 表单值类型。
 * @param rows - 按 Store 顺序排列的行身份和路径。
 */
export type ArraySchemaFactory<TValues extends Values = Values> = (
  rows: readonly DynamicRowState[]
) => readonly SchemxField<TValues>[]

/**
 * 一次数组行与子树协调所需的输入。
 * @typeParam TValues - 表单值类型。
 */
export interface ReconcileArrayOptions<TValues extends Values = Values> {
  /**
   * Store 当前完整的稳定行 key 列表。
   */
  readonly keys: readonly string[]
  /**
   * Store 已经移动数据时跳过旧路径值清理。
   */
  readonly preserveValues?: boolean
  /**
   * 根据协调后的行身份生成当前子 Schema。
   */
  readonly createSchemas: ArraySchemaFactory<TValues>
}

/**
 * Schema Runtime 的内部上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享实例级基础服务。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FormRuntimeContext<TValues extends Values = Values> {
  /**
   * 只在完整实例组装后读取，供节点视图注入稳定的 Form 实例。
   * @example const form = context.getInstance()
   */
  getInstance(): SchemxInstance<TValues>
  /**
   * 是否启用 Runtime diagnostics。
   */
  readonly debug: boolean
  /**
   * 字段状态、路径注册和校验资源统一使用的操作入口。
   */
  readonly store: RuntimeStorePort<TValues>
  /**
   * 节点使用的最小校验资源能力。
   */
  readonly validator: RuntimeValidationPort<TValues>
  /**
   * 当前 Form 唯一的节点树、路径索引和数组行归属管理器。
   */
  readonly nodeManager: NodeManager<TValues>
  /**
   * 传递给动态 renderer 的表单 API 子集。
   */
  readonly formApi: SchemxFormApi<TValues>
  /**
   * 按字段路径配置的表单级校验规则。
   */
  readonly fieldRules: SchemxFieldRulesMap<TValues>
  /**
   * 运行时异步调度器。
   */
  readonly scheduler: Scheduler
}
