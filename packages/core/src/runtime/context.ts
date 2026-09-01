/**
 * Schemx form 实例级运行时上下文。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 *
 * @typeParam TValues - 表单值对象类型。
 */

import type { NodeLifecycleEmitter } from "./lifecycle"
import type { ContainerNode, NodeId } from "./node"
import type { Scheduler } from "./scheduler"
import type {
  FieldValue,
  NamePath,
  SchemxField,
  SchemxFieldRulesMap,
  SchemxFormApi,
  SchemxInstance,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type { FieldRules } from "../types/rule"
import type { FieldValidationConfig } from "../validator/types"

/**
 * Runtime 访问字段状态和初始值所需的最小 Store 能力。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RuntimeStorePort<TValues extends Values = Values> {
  registerFieldPath<TName extends NamePath<TValues>>(name: TName): void
  unregisterFieldPath<TName extends NamePath<TValues>>(name: TName): void
  getFieldValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined
  setFieldValue<TName extends NamePath<TValues>>(
    name: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void
  /**
   * 删除指定字段的当前值并清理其临时交互状态。
   *
   * @param name - 要删除的字段路径；不会修改初始值。
   */
  removeFieldValue<TName extends NamePath<TValues>>(name: TName): void
  setInitialValues(values: Partial<TValues>): void
}

/**
 * Runtime 管理字段校验所需的最小 Validator 能力。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RuntimeValidationPort<TValues extends Values = Values> {
  setFieldConfig<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): void
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName> | undefined
  ): void
  removeField(name: NamePath<TValues>): void
}

/**
 * Schema Runtime 的内部上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享实例级服务。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaRuntimeContext<TValues extends Values = Values> {
  /** 是否启用 Runtime diagnostics。 */
  readonly debug: boolean
  /**
   * schema 编译默认选项，供 root 与 dependency 子树复用。
   */
  schemaConfig: SchemxSchemaConfig
  /**
   * 表单实例公开 API。
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * Runtime 访问字段状态和初始值的最小 Store Port。
   */
  readonly store: RuntimeStorePort<TValues>
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
  /**
   * Runtime 同步和移除字段校验配置所需的最小端口。
   */
  readonly validation: RuntimeValidationPort<TValues>
  /**
   * Node 生命周期事件发布器。
   */
  readonly lifecycle: NodeLifecycleEmitter<ContainerNode<TValues>>
  /**
   * 唯一子节点提交边界。
   *
   * @param parent - 接收子节点的容器 Node。
   * @param schemas - 新一轮原始子 schema 列表。
   */
  reconcileChildren(parentId: NodeId, schemas: readonly SchemxField<TValues>[]): void
}
