/**
 * Schemx form 实例级运行时上下文。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 *
 * @typeParam TValues - 表单值对象类型。
 */

import type { Compile } from "./compiler/types"
import type { LifecycleBus } from "./lifecycle"
import type { ParentRuntimeNode, RuntimeNode, RuntimeRegistry } from "./node"
import type { Scheduler } from "./scheduler"
import type { RuntimeFormModelPort } from "../form/model"
import type {
  NamePath,
  ResolvedSchemxSchemaConfig,
  SchemxField,
  SchemxFormApi,
  SchemxInstance,
  Values,
} from "../types"
import type { FieldValidationConfig } from "../validator"

/**
 * Runtime 同步字段校验所需的最小能力端口。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RuntimeValidationPort<TValues extends Values = Values> {
  /**
   * 同步字段校验配置，并返回配置是否发生变化。
   */
  syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean
  /**
   * 移除字段校验配置。
   */
  removeField(name: NamePath<TValues>): void
  /**
   * 停止 Schema 规则注册，但保留运行时规则覆盖。
   */
  removeSchemaField(name: NamePath<TValues>): void
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
  schemaConfig: ResolvedSchemxSchemaConfig
  /**
   * 表单实例公开 API。
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * Runtime 访问字段状态和初始值的最小 Model Port。
   */
  readonly model: RuntimeFormModelPort<TValues>
  /**
   * 传递给动态 renderer 的表单 API 子集。
   */
  readonly formApi: SchemxFormApi<TValues>
  /**
   * 当前表单实例的 schema 编译门面。
   */
  readonly compile: Compile<TValues>
  /**
   * 运行时异步调度器。
   */
  readonly scheduler: Scheduler
  /**
   * Runtime 同步和移除字段校验配置所需的最小端口。
   */
  readonly validation: RuntimeValidationPort<TValues>
  /**
   * runtime node 生命周期事件总线。
   */
  readonly lifecycleBus: LifecycleBus<RuntimeNode<TValues>>
  /**
   * Runtime 跨节点查询注册表。
   */
  readonly runtimeRegistry: RuntimeRegistry<TValues>
  /**
   * 唯一子节点提交边界。
   *
   * @param parent - 接收子节点的容器 RuntimeNode。
   * @param schemas - 新一轮原始子 schema 列表。
   */
  reconcileChildren(
    parent: ParentRuntimeNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): void
}
