/**
 * Schemx form 实例级运行时上下文。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 *
 * @typeParam TValues - 表单值对象类型。
 * @module core/runtime/context
 */

import type { NodeLifecycleEmitter } from "./lifecycle"
import type { ContainerNode, NodeId } from "./node"
import type { Scheduler } from "./scheduler"
import type { PresetRuleEntry } from "../registry"
import type { ArrayStructureHandle } from "../store"
import type {
  FieldArrayChange,
  FieldArrayPath,
  FieldValue,
  NamePath,
  SchemxField,
  SchemxFieldRulesMap,
  SchemxFormApi,
  SchemxInstance,
  SchemxSchemaConfig,
  SetValueAction,
  SetValuesAction,
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
  /**
   * 注册字段路径，使 Store 为该字段维护当前值和交互状态。
   *
   * @param name - 要注册的字段路径。
   */
  registerFieldPath<TName extends NamePath<TValues>>(name: TName): void

  /**
   * 注销字段路径，但不负责删除字段值。
   *
   * @param name - 要注销的字段路径。
   */
  unregisterFieldPath<TName extends NamePath<TValues>>(name: TName): void

  /**
   * 读取字段当前值。
   *
   * @param name - 要读取的字段路径。
   * @returns 当前字段值；未设置时返回 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 按动作更新字段当前值。
   *
   * @param name - 要更新的字段路径。
   * @param action - 描述新值或更新方式的动作。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    name: TName,
    action: SetValueAction<TValues, TName>
  ): void

  /**
   * 获取字段数组的结构句柄，用于读取行 key 并订阅增删改移动变化。
   *
   * @param name - 字段数组路径。
   * @returns 字段数组结构句柄。
   */
  getArrayStructureHandle<TPath extends FieldArrayPath<TValues>>(
    name: TPath
  ): ArrayStructureHandle
  /**
   * 删除指定字段的当前值并清理其临时交互状态。
   *
   * @param name - 要删除的字段路径；不会修改初始值。
   */
  removeFieldValue<TName extends NamePath<TValues>>(name: TName): void

  /**
   * 合并表单初始值。
   *
   * @param action - 描述初始值更新方式的动作。
   */
  setInitialValues(action: SetValuesAction<TValues>): void

  /** 按字段路径写入初始值基线。 */
  setInitialValue?<TName extends NamePath<TValues>>(
    name: TName,
    action: SetValueAction<TValues, TName>
  ): void
}

/**
 * Runtime 管理字段校验所需的最小 Validator 能力。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RuntimeValidationPort<TValues extends Values = Values> {
  /**
   * 写入字段的校验基础配置，包括标签、占位文本和必填状态。
   *
   * @param config - 字段路径、标签、占位文本和必填状态。
   */
  setFieldConfig<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): void

  /**
   * 写入字段的校验规则。
   *
   * @param name - 要更新规则的字段路径。
   * @param rules - 字段规则；传入 `undefined` 表示清除规则。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName> | PresetRuleEntry<unknown> | undefined
  ): void

  /**
   * 移除字段的校验配置和错误状态。
   *
   * @param name - 要移除校验配置的字段路径。
   */
  removeField(name: NamePath<TValues>): void

  /**
   * 通知 Validator 字段数组结构发生变化。
   *
   * @param path - 发生变化的字段数组路径。
   * @param change - 数组结构变化详情。
   */
  invalidateFieldArray(path: NamePath<TValues>, change: FieldArrayChange): void
}

/**
 * Schema Runtime 的内部上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享实例级服务。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaRuntimeContext<TValues extends Values = Values> {
  /**
   * 是否启用 Runtime diagnostics。
   */
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
   * @param parentId - 接收子节点的容器 Node id。
   * @param schemas - 新一轮原始子 schema 列表。
   */
  reconcileChildren(parentId: NodeId, schemas: readonly SchemxField<TValues>[]): void
}
