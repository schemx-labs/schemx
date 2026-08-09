/**
 * RuntimeNode 子系统类型定义。
 *
 * 定义所有 RuntimeNode 类型（root / field / group / dependency）、
 * 查询索引（fieldIndex）、生命周期接口（RuntimeDispose / Scope）、
 * 以及创建选项（Create*Options）。
 *
 * @module core/runtime/node/types
 */

import type {
  DependencyRenderer,
  DependencyRuntimeNodeInput,
  FieldDynamicProps,
  FieldRuntimeNodeInput,
  FieldValidation,
  GroupRuntimeNodeInput,
  PresentationDynamicProps,
  PresentationStaticState,
  RuntimeNodeInput,
} from "./input"
import type { Signal } from "../../reactivity"
import type {
  NamePath,
  SchemxDependencyField,
  SchemxRendererKey,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  Values,
} from "../../types"
import type { DependencyRendererEffect } from "../dependency/rendererEffect"
import type { FieldRuntimeState } from "../field/runtimeState"
import type { PresentationRuntimeState } from "../presentation/state"
import type {
  DependencyViewState,
  FieldNodeViewState,
  GroupViewState,
  RootViewState,
} from "../view/createViewState"

/**
 * RuntimeDispose 执行的清理函数。
 */
export type RuntimeCleanup = () => void

/**
 * cleanup 注册后的释放句柄。
 *
 * 可通过 handle.dispose() 提前释放该 cleanup，不影响 scope 整体生命周期。
 */
export interface RuntimeCleanupHandle {
  /** 标记该清理任务是否已经执行或被释放。 */
  readonly disposed: boolean
  /**
   * 提前执行该 cleanup 并从 scope 注销；幂等。
   */
  dispose(): void
}

/**
 * Runtime 资源生命周期边界。
 *
 * 提供资源注册（add）、子 scope 创建（child）、以及整体释放（dispose）能力。
 * dispose 幂等；先释放子 scope，再按 LIFO 执行当前 scope 的 cleanup。
 */
export interface RuntimeDispose {
  /** 标记当前 scope 是否已经进入释放状态。 */
  readonly disposed: boolean
  /**
   * 注册一个 cleanup 函数，返回可提前释放的句柄。
   */
  add(cleanup: RuntimeCleanup): RuntimeCleanupHandle
  /**
   * 创建子 scope；父 scope 释放时自动释放子 scope。
   */
  child(): RuntimeDispose
  /**
   * 释放当前 scope 及所有子 scope，按 LIFO 执行 cleanup；幂等。
   */
  dispose(): void
}

/**
 * @ignore 与 RuntimeCleanup 同义
 */
export type ScopeCleanup = RuntimeCleanup
/**
 * @ignore 与 RuntimeCleanupHandle 同义
 */
export type ScopeCleanupHandle = RuntimeCleanupHandle
/**
 * @ignore 与 RuntimeDispose 同义
 */
export type Scope = RuntimeDispose

/**
 * Scope 内部存储的 cleanup 记录。
 */
export interface ScopeCleanupRecord {
  /** 当前记录对应的清理函数。 */
  cleanup: ScopeCleanup
  /** 标记该清理函数是否已经执行。 */
  disposed: boolean
}

/**
 * Runtime node 支持的节点类型。
 */
export type RuntimeNodeType = "root" | "field" | "group" | "dependency"

/**
 * RuntimeNode 内部稳定 id。
 */
export type RuntimeNodeId = number

/**
 * 所有 RuntimeNode 共享的结构字段。
 */
interface BaseRuntimeNode<TValues extends Values = Values> {
  /**
   * RuntimeNode 内部稳定 id。
   */
  readonly id: RuntimeNodeId

  /**
   * 用于 keyed reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: RuntimeNodeType

  /**
   * 父 RuntimeNode。
   *
   * root 节点没有 parent（值为 null）。
   */
  parent: RuntimeNode<TValues> | null

  /**
   * RuntimeNode 自身的完整生命周期边界。
   *
   * 当 node 被 reconcile 移除时调用 dispose()。
   */
  dispose: RuntimeDispose

  /**
   * 节点是否已经进入销毁流程。
   */
  disposed: Signal<boolean>
}

/**
 * RootRuntimeNode - 透明根节点。
 *
 * Root 不对应任何 schema，只负责承载顶层 children。
 */
export interface RootRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /** 根节点类型标记。 */
  readonly type: "root"

  /** 根节点没有父节点，始终为 null。 */
  parent: null

  /**
   * 顶层 runtime 子节点。
   */
  childNodes: Signal<readonly SchemaRuntimeNode<TValues>[]>

  /** 根节点的视图状态。 */
  viewState: RootViewState<TValues> | null
}

/**
 * FieldRuntimeNode - 字段节点。
 *
 * Field 不承载结构子节点，已解析配置直接挂在 node 上。
 * 额外持有 fieldState（运行时状态）、viewState（视图状态）和 effectDispose（校验 effect 生命周期）。
 */
export interface FieldRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /** 字段节点类型标记。 */
  readonly type: "field"

  /** 字段节点的父容器；根字段的 parent 为 null。 */
  parent: ParentRuntimeNode<TValues> | null

  /** 当前字段配置的身份令牌。 */
  configToken: symbol

  /** 字段路径。 */
  name: NamePath<TValues>

  /** 渲染器类型。 */
  componentType: SchemxRendererKey

  /** 编译后的静态字段配置。 */
  staticSchema: SchemxResolvedBaseField<TValues>

  /** 字段动态属性配置。 */
  dynamicProps: FieldDynamicProps<TValues> | null

  /** 字段校验配置。 */
  validation: FieldValidation<TValues> | null

  /** 字段值、错误和交互状态。 */
  fieldState: FieldRuntimeState<TValues> | null

  /** 字段在渲染层的视图状态。 */
  viewState: FieldNodeViewState<TValues> | null

  /** 字段级 effect 的资源作用域。 */
  effectDispose: RuntimeDispose | null

  /** 仅管理字段 dependencies effect 的独立作用域。 */
  dependenciesEffectDispose: RuntimeDispose | null
}

/**
 * GroupRuntimeNode - 分组节点。
 *
 * Group 负责 schema 结构嵌套，通过 childNodes 承载静态编译后的子节点。
 */
export interface GroupRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /** 分组节点类型标记。 */
  readonly type: "group"

  /** 分组节点的父容器；根分组的 parent 为 null。 */
  parent: ParentRuntimeNode<TValues> | null

  /** 当前分组配置的身份令牌。 */
  configToken: symbol

  /** 编译后的静态分组配置。 */
  staticSchema: SchemxResolvedGroupField<TValues>

  /** 分组的静态呈现状态。 */
  staticState: PresentationStaticState

  /** 分组动态属性配置。 */
  dynamicProps: PresentationDynamicProps<TValues> | null

  /** 分组在渲染层的视图状态。 */
  viewState: GroupViewState<TValues> | null

  /** 分组继承和解析后的呈现状态。 */
  presentationState: PresentationRuntimeState | null

  /** 分组呈现 effect 的资源作用域。 */
  presentationEffectScope: RuntimeDispose | null

  /**
   * 静态 schema children 编译后的 runtime 子节点。
   */
  childNodes: Signal<readonly SchemaRuntimeNode<TValues>[]>
}

/**
 * DependencyRuntimeNode - 动态 dependency 节点。
 *
 * Dependency 的 children 来自 renderer 动态产物，而非静态编译。
 * 额外持有 rendererEffect，用于管理动态 renderer 的执行状态与生命周期。
 */
export interface DependencyRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /** 依赖节点类型标记。 */
  readonly type: "dependency"

  /** 依赖节点的父容器；根依赖的 parent 为 null。 */
  parent: ParentRuntimeNode<TValues> | null

  /** 当前依赖配置的身份令牌。 */
  configToken: symbol

  /** 触发动态 renderer 重新执行的字段路径。 */
  triggerFields: readonly NamePath<TValues>[]

  /** 生成动态子 Schema 的 renderer。 */
  renderer: DependencyRenderer<TValues>

  /** 原始 renderer 引用，用于判断 renderer 是否发生变化。 */
  rendererIdentity: SchemxDependencyField<TValues>["renderer"]

  /** 依赖节点的静态呈现状态。 */
  staticState: PresentationStaticState

  /** 依赖节点动态属性配置。 */
  dynamicProps: PresentationDynamicProps<TValues> | null

  /** 依赖节点在渲染层的视图状态。 */
  viewState: DependencyViewState<TValues> | null

  /** 动态 renderer 的执行状态与资源作用域。 */
  rendererEffect: DependencyRendererEffect | null

  /** 依赖节点继承和解析后的呈现状态。 */
  presentationState: PresentationRuntimeState | null

  /** 依赖节点呈现 effect 的资源作用域。 */
  presentationEffectScope: RuntimeDispose | null

  /**
   * dependency renderer 产出的动态 runtime 子节点。
   */
  childNodes: Signal<readonly SchemaRuntimeNode<TValues>[]>
}

/**
 * 所有 RuntimeNode 的联合类型。
 */
export type RuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 除 root 外，所有由 schema 创建的 RuntimeNode。
 *
 * 即 FieldRuntimeNode | GroupRuntimeNode | DependencyRuntimeNode。
 */
export type SchemaRuntimeNode<TValues extends Values = Values> =
  FieldRuntimeNode<TValues> | GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 可以承载子节点的 RuntimeNode。
 *
 * 即 RootRuntimeNode | GroupRuntimeNode | DependencyRuntimeNode。
 * field 节点没有子节点。
 */
export type ParentRuntimeNode<TValues extends Values = Values> =
  RootRuntimeNode<TValues> | GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 容器 children 响应式状态。
 */
export interface RuntimeChildrenState<TValues extends Values = Values> {
  /** 当前容器节点的响应式子节点列表。 */
  readonly children: Signal<readonly SchemaRuntimeNode<TValues>[]>
}

/**
 * 运行时字段索引接口。
 *
 * 维护字段名称到 FieldRuntimeNode 的映射，支持按名查找和按路径查找。
 */
export interface RuntimeFieldIndex<TValues extends Values = Values> {
  /** 注册字段节点。 */
  register(node: FieldRuntimeNode<TValues>): void
  /** 注销字段节点，并使用给定路径移除索引。 */
  unregister(node: FieldRuntimeNode<TValues>, name: NamePath<TValues>): void
  /** 按字段路径查询节点。 */
  get(name: NamePath<TValues>): FieldRuntimeNode<TValues> | undefined
}

/**
 * Runtime 跨节点查询注册表。
 *
 * 仅维护字段名到字段节点的映射。
 */
export interface RuntimeRegistry<TValues extends Values = Values> {
  /** 按字段路径索引运行时字段节点。 */
  readonly fieldIndex: RuntimeFieldIndex<TValues>
}

/**
 * RootRuntimeNode 创建选项。
 */
export interface CreateRootRuntimeNodeOptions {
  /** 根节点使用的资源作用域。 */
  dispose: RuntimeDispose
}

/**
 * FieldRuntimeNode 创建选项。
 */
export interface CreateFieldRuntimeNodeOptions<TValues extends Values = Values> {
  /** 分配给字段节点的稳定 id。 */
  id: RuntimeNodeId
  /** 编译后的字段节点输入。 */
  input: FieldRuntimeNodeInput<TValues>
  /** 字段节点的父容器。 */
  parent?: ParentRuntimeNode<TValues> | null
  /** 字段节点使用的资源作用域。 */
  dispose?: RuntimeDispose
}

/**
 * GroupRuntimeNode 创建选项。
 */
export interface CreateGroupRuntimeNodeOptions<TValues extends Values = Values> {
  /** 分配给分组节点的稳定 id。 */
  id: RuntimeNodeId
  /** 编译后的分组节点输入。 */
  input: GroupRuntimeNodeInput<TValues>
  /** 分组节点的父容器。 */
  parent?: ParentRuntimeNode<TValues> | null
  /** 分组节点使用的资源作用域。 */
  dispose?: RuntimeDispose
}

/**
 * DependencyRuntimeNode 创建选项。
 */
export interface CreateDependencyRuntimeNodeOptions<TValues extends Values = Values> {
  /** 分配给依赖节点的稳定 id。 */
  id: RuntimeNodeId
  /** 编译后的依赖节点输入。 */
  input: DependencyRuntimeNodeInput<TValues>
  /** 依赖节点的父容器。 */
  parent?: ParentRuntimeNode<TValues> | null
  /** 依赖节点使用的资源作用域。 */
  dispose?: RuntimeDispose
}

/**
 * 非 root 节点的通用创建选项。
 */
export interface CreateRuntimeNodeOptions<TValues extends Values = Values> {
  /** 编译后的节点输入。 */
  input: RuntimeNodeInput<TValues>
  /** 节点的父容器。 */
  parent?: ParentRuntimeNode<TValues> | null
  /** 节点使用的资源作用域。 */
  dispose?: RuntimeDispose
}

/**
 * RuntimeNodeManager 创建选项。
 */
export interface CreateRuntimeNodeManagerOptions<TValues extends Values = Values> {
  /** 可选的运行时查询注册表。 */
  registry?: RuntimeRegistry<TValues>
}

/**
 * RuntimeNodeManager 接口。
 *
 * 提供 runtime tree 的全部结构操作：创建、查询、遍历、插入、替换、移除和删除子树。
 */
export interface RuntimeNodeManager<TValues extends Values = Values> {
  /**
   * 创建并注册根节点。
   */
  createRoot(): RootRuntimeNode<TValues>
  /**
   * 根据输入创建对应节点并分配 ID（尚未挂载到父节点）。
   */
  createNode(options: CreateRuntimeNodeOptions<TValues>): SchemaRuntimeNode<TValues>
  /**
   * 深度优先遍历 root 及其全部后代节点，检测循环/重复引用。
   */
  traverse(root: RuntimeNode<TValues>): RuntimeNode<TValues>[]
  /**
   * 将 child 插入 parent 的指定位置（默认末尾）；跨父移动时先从原父节点移除。
   */
  insertChild(
    parent: ParentRuntimeNode<TValues>,
    child: SchemaRuntimeNode<TValues>,
    index?: number
  ): void
  /**
   * 用 children 整体替换 parent 的全部子节点（按引用去重、自动迁移旧父节点）。
   */
  replaceChildren(
    parent: ParentRuntimeNode<TValues>,
    children: readonly SchemaRuntimeNode<TValues>[]
  ): void
  /**
   * 从 parent 移除一个直接子节点；不释放资源、不删除后代。
   */
  removeChild(parent: ParentRuntimeNode<TValues>, child: SchemaRuntimeNode<TValues>): void
  /**
   * 递归删除 node 子树：解除父子关系、释放子节点与 scope 并清理资源。
   */
  removeSubtree(node: RuntimeNode<TValues>): void
}
