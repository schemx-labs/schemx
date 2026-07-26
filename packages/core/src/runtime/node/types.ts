/**
 * RuntimeNode 子系统类型定义。
 *
 * 定义所有 RuntimeNode 类型（root / field / group / dependency）、
 * 资源索引（fieldIndex / dependencyIndex）、生命周期接口（RuntimeDispose / Scope）、
 * 以及创建选项（Create*Options）。
 *
 * @module core/runtime/node/types
 */

import type { Signal } from "../../reactivity"
import type { NamePath, Values } from "../../types"
import type { ContainerRuntimeState } from "../container/runtimeState"
import type { FormDescriptor } from "../descriptor"
import type { DependencyEffectState } from "../field/dependencyEffect"
import type { FieldRuntimeState } from "../field/runtimeState"
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
  cleanup: ScopeCleanup
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
   * 领域资源是否已经完成挂载。
   */
  mounted: Signal<boolean>

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
  readonly type: "root"

  parent: null

  /**
   * 顶层 runtime 子节点。
   */
  childNodes: Signal<readonly DescribedRuntimeNode<TValues>[]>

  viewState: RootViewState<TValues> | null
}

/**
 * FieldRuntimeNode - 字段节点。
 *
 * Field 不承载结构子节点，当前 descriptor 直接挂在 node 上。
 * 额外持有 fieldState（运行时状态）、viewState（视图状态）和 effectDispose（校验 effect 生命周期）。
 */
export interface FieldRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "field"

  parent: ContainerRuntimeNode<TValues> | null

  descriptor: FormDescriptor<TValues> | null

  fieldState: FieldRuntimeState<TValues> | null

  viewState: FieldNodeViewState<TValues> | null

  effectDispose: RuntimeDispose | null
}

/**
 * GroupRuntimeNode - 分组节点。
 *
 * Group 负责 schema 结构嵌套，通过 childNodes 承载静态编译后的子节点。
 */
export interface GroupRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "group"

  parent: ContainerRuntimeNode<TValues> | null

  descriptor: FormDescriptor<TValues> | null

  viewState: GroupViewState<TValues> | null

  containerState: ContainerRuntimeState | null

  containerEffectDispose: RuntimeDispose | null

  /**
   * 静态 schema children 编译后的 runtime 子节点。
   */
  childNodes: Signal<readonly DescribedRuntimeNode<TValues>[]>
}

/**
 * DependencyRuntimeNode - 动态 dependency 节点。
 *
 * Dependency 的 children 来自 renderer 动态产物，而非静态编译。
 * 额外持有 effectState（dependency effect 状态）和 dependencyDispose（effect 生命周期）。
 */
export interface DependencyRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "dependency"

  parent: ContainerRuntimeNode<TValues> | null

  descriptor: FormDescriptor<TValues> | null

  viewState: DependencyViewState<TValues> | null

  effectState: DependencyEffectState | null

  dependencyDispose: RuntimeDispose | null

  containerState: ContainerRuntimeState | null

  containerEffectDispose: RuntimeDispose | null

  /**
   * dependency renderer 产出的动态 runtime 子节点。
   */
  childNodes: Signal<readonly DescribedRuntimeNode<TValues>[]>
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
 * 除 root 外，所有带 descriptor 的 RuntimeNode。
 *
 * 即 FieldRuntimeNode | GroupRuntimeNode | DependencyRuntimeNode。
 */
export type DescribedRuntimeNode<TValues extends Values = Values> =
  FieldRuntimeNode<TValues> | GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 可以承载子节点的 RuntimeNode。
 *
 * 即 RootRuntimeNode | GroupRuntimeNode | DependencyRuntimeNode。
 * field 节点没有子节点。
 */
export type ContainerRuntimeNode<TValues extends Values = Values> =
  RootRuntimeNode<TValues> | GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 容器 children 响应式状态。
 */
export interface RuntimeChildrenState<TValues extends Values = Values> {
  readonly children: Signal<readonly DescribedRuntimeNode<TValues>[]>
}

/**
 * 运行时字段索引接口。
 *
 * 维护字段名称到 FieldRuntimeNode 的映射，支持按名查找和按路径查找。
 */
export interface RuntimeFieldIndex<TValues extends Values = Values> {
  register(node: FieldRuntimeNode<TValues>): void
  unregister(node: FieldRuntimeNode<TValues>): void
  getByName(name: NamePath<TValues>): FieldRuntimeNode<TValues> | undefined
  getByPath(path: NamePath<TValues>): FieldRuntimeNode<TValues> | undefined
}

/**
 * 运行时 dependency 索引接口。
 *
 * 维护触发字段与 dependency 节点的双向映射，支持按触发字段查找节点和按节点查找触发字段。
 */
export interface RuntimeDependencyIndex<TValues extends Values = Values> {
  register(node: DependencyRuntimeNode<TValues>): void
  unregister(node: DependencyRuntimeNode<TValues>): void
  getByTriggerField(name: NamePath<TValues>): readonly DependencyRuntimeNode<TValues>[]
  getTriggerFields(node: DependencyRuntimeNode<TValues>): readonly NamePath<TValues>[]
}

/**
 * RuntimeNode 之外的领域资源注册表。
 *
 * 包含三个子表：
 * - nodes: 所有 RuntimeNode 的 ID 索引
 * - fieldIndex: 字段名到字段节点的映射
 * - dependencyIndex: 触发字段到 dependency 节点的双向映射
 */
export interface RuntimeNodeResourceContext<TValues extends Values = Values> {
  readonly nodes: Map<RuntimeNodeId, RuntimeNode<TValues>>
  readonly fieldIndex: RuntimeFieldIndex<TValues>
  readonly dependencyIndex: RuntimeDependencyIndex<TValues>
}

/**
 * RuntimeNodeResourceContext 中各子表类型的映射工具类型。
 *
 * 将 RuntimeNodeResourceContext 的每个 key 映射为其值的类型，方便泛型推导。
 */
export type RuntimeNodeResourceMaps<TValues extends Values = Values> = {
  [K in keyof RuntimeNodeResourceContext<TValues>]: RuntimeNodeResourceContext<TValues>[K]
}

/**
 * RootRuntimeNode 创建选项。
 */
export interface CreateRootRuntimeNodeOptions {
  dispose: RuntimeDispose
}

/**
 * FieldRuntimeNode 创建选项。
 */
export interface CreateFieldRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  dispose?: RuntimeDispose
}

/**
 * GroupRuntimeNode 创建选项。
 */
export interface CreateGroupRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  dispose?: RuntimeDispose
}

/**
 * DependencyRuntimeNode 创建选项。
 */
export interface CreateDependencyRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  dispose?: RuntimeDispose
}

/**
 * 非 root 节点的通用创建选项。
 */
export interface CreateRuntimeNodeOptions<TValues extends Values = Values> {
  type: Exclude<RuntimeNodeType, "root">
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  dispose?: RuntimeDispose
}

/**
 * RuntimeNodeManager 创建选项。
 */
export interface CreateRuntimeNodeManagerOptions<TValues extends Values = Values> {
  resources?: RuntimeNodeResourceContext<TValues>
}

/**
 * RuntimeNodeManager 接口。
 *
 * 提供 runtime tree 的全部结构操作：创建、查询、遍历、插入、替换、移除和删除子树。
 */
export interface RuntimeNodeManager<TValues extends Values = Values> {
  readonly resources: RuntimeNodeResourceContext<TValues>
  readonly nodes: Map<RuntimeNodeId, RuntimeNode<TValues>>
  /**
   * 创建并注册无 descriptor 的根节点。
   */
  createRoot(): RootRuntimeNode<TValues>
  /**
   * 根据 descriptor 创建节点并挂载到指定父节点下。
   */
  create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DescribedRuntimeNode<TValues>
  /**
   * 根据 type 创建对应节点，分配 ID 并注册到 nodes Map（尚未挂载到父节点）。
   */
  createNode(options: CreateRuntimeNodeOptions<TValues>): DescribedRuntimeNode<TValues>
  /**
   * 根据节点 ID 查询节点，不存在时返回 undefined。
   */
  getNode(nodeId: RuntimeNodeId): RuntimeNode<TValues> | undefined
  /**
   * 深度优先遍历 root 及其全部后代节点，检测循环/重复引用。
   */
  traverse(root: RuntimeNode<TValues>): RuntimeNode<TValues>[]
  /**
   * 将 child 插入 parent 的指定位置（默认末尾）；跨父移动时先从原父节点移除。
   */
  insertChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>,
    index?: number
  ): void
  /**
   * 用 children 整体替换 parent 的全部子节点（按引用去重、自动迁移旧父节点）。
   */
  replaceChildren(
    parent: ContainerRuntimeNode<TValues>,
    children: readonly DescribedRuntimeNode<TValues>[]
  ): void
  /**
   * 从 parent 移除一个直接子节点；不释放资源、不删除后代。
   */
  removeChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void
  /**
   * 递归删除 node 子树：解除父子关系、释放子节点与 scope、清理资源、移出 nodes Map。
   */
  removeSubtree(node: RuntimeNode<TValues>): void
}
