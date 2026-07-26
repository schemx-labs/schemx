/**
 * Schemx form 实例级运行时上下文。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 *
 * @typeParam TValues - 表单值对象类型。
 */

import type { Compile } from "./compiler/types"
import type { FormDescriptor } from "./descriptor"
import type { LifecycleBus } from "./lifecycle"
import type {
  ContainerRuntimeNode,
  RuntimeNode,
  RuntimeNodeResourceContext,
} from "./node"
import type { Scheduler } from "./scheduler"
import type { RuntimeFormModelPort } from "../form/model"
import type {
  NamePath,
  ResolvedSchemxDefaultProps,
  SchemxFormApi,
  SchemxInstance,
  Values,
} from "../types"
import type { FieldValidationConfig, ValidationController } from "../validator"

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
}

/**
 * `createForm()` 内部运行时上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享实例级服务。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxContext<TValues extends Values = Values> {
  /**
   * schema 编译默认选项，供 root 与 dependency 子树复用。
   */
  defaultProps: ResolvedSchemxDefaultProps
  /**
   * 表单实例公开 API。
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * RuntimeNode 访问表单状态与校验控制器所需的最小 Model Port。
   *
   * 兼容独立构造的历史 context，因此当前保持可选；createForm 创建的 Runtime
   * 始终提供该 Port。
   */
  readonly model?: RuntimeFormModelPort<TValues>
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
   * 当前表单实例的字段校验控制器。
   */
  readonly validation: ValidationController<TValues>
  /**
   * runtime node 生命周期事件总线。
   */
  readonly lifecycleBus: LifecycleBus<RuntimeNode<TValues>>
  /**
   * RuntimeNode 之外的领域资源注册表与跨节点查询索引。
   */
  readonly nodeResources: RuntimeNodeResourceContext<TValues>
  /**
   * 唯一子节点提交边界。
   *
   * @param parent - 接收子节点的容器 RuntimeNode。
   * @param descriptors - 新一轮编译得到的子 descriptor 列表。
   */
  commitChildren(
    parent: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void
}

/**
 * Schema Runtime 的内部上下文。
 *
 * 与公开的 {@link SchemxContext} 分离：Runtime 持有非可选的最小 Model Port，
 * 并且只能使用字段校验同步所需的能力。公开 Context 保留完整字段以兼容历史构造方式。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface SchemaRuntimeContext<TValues extends Values = Values> extends Omit<
  SchemxContext<TValues>,
  "model" | "validation"
> {
  /**
   * Runtime 访问字段状态和初始值的最小 Model Port。
   */
  readonly model: RuntimeFormModelPort<TValues>
  /**
   * Runtime 同步和移除字段校验配置的最小端口。
   */
  readonly validation: RuntimeValidationPort<TValues>
}
