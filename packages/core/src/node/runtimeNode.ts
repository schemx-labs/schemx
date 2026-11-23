/**
 * RuntimeNode - 内部 node 的结构节点。
 *
 * RuntimeNode 不感知 schema、form、validation、renderer。
 * 只表达：
 * - 身份（id, key, type）
 * - 父子结构（parent, childNodes/dynamicChildNodes）
 * - 所有权（scope）
 * - 生命周期（disposed）
 * - 表单内部资源（descriptor, fieldModel, dependencySlot）
 * - 领域资源作用域（fieldResourceScope, fieldDependenciesScope, dependencyResourceScope）
 *
 * @module core/node/node
 */

import { Values } from "../types"
import { findNodeBFS } from "../utils/find"

import type { Scope } from "./scope"
import type {
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../descriptor/descriptor"
import type { DependencyEffectSlot } from "../field/dependencyEffect"
import type { FieldModel } from "../field/model"
import type { Signal } from "../reactivity"
import type { NamePath } from "../types"

/**
 * Runtime node 支持的节点类型。
 */
export type RuntimeNodeType = "root" | "field" | "group" | "dependency"

/**
 * 所有 RuntimeNode 共享的结构字段。
 *
 * @remarks
 * `scope` 表示 RuntimeNode 自身的完整生命周期；字段、dependency 等可重启资源应使用
 * 子 scope 表达更细的资源边界。
 */
interface BaseRuntimeNode<TValues extends Values = Values> {
  /**
   * Runtime node 内部的稳定节点 id。
   */
  readonly id: number

  /**
   * 用于 keyed reconcile 的描述符 key。
   */
  readonly key: string

  /**
   * 父 RuntimeNode；root 没有父节点。
   */
  parent: RuntimeNode<TValues> | null

  /**
   * RuntimeNode 的顶层生命周期作用域。
   */
  scope: Scope

  /**
   * 是否已经进入销毁流程。
   */
  disposed: Signal<boolean>

  /**
   * 领域资源是否已经挂载。
   */
  mounted: Signal<boolean>
}

/**
 * Runtime node 的透明根节点。
 *
 * @remarks
 * Root 不对应任何 schema，只负责承载顶层 `childNodes`。
 */
export interface RootRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /**
   * RuntimeNode 类型标识，表示 node 的透明根节点。
   */
  readonly type: "root"

  /**
   * 顶层 runtime 子节点列表。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * 字段 RuntimeNode，持有字段描述符、字段模型和字段相关资源作用域。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /**
   * RuntimeNode 类型标识，表示普通字段节点。
   */
  readonly type: "field"

  /**
   * 字段对应的编译后描述符。
   */
  descriptor: FieldDescriptor<TValues>

  /**
   * 字段运行时模型；卸载字段主体资源后会被清空或重建。
   */
  fieldModel: FieldModel<TValues> | null

  /**
   * 字段模型、注册表、校验 effect 等字段主体资源的生命周期边界。
   */
  fieldResourceScope: Scope | null

  /**
   * 字段 `dependencies` effect 的独立生命周期边界。
   */
  fieldDependenciesScope: Scope | null
}

/**
 * 分组 RuntimeNode，只负责结构嵌套和布局语义。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface GroupRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /**
   * RuntimeNode 类型标识，表示结构分组节点。
   */
  readonly type: "group"

  /**
   * 分组对应的编译后描述符。
   */
  descriptor: GroupDescriptor<TValues>

  /**
   * 分组下的 runtime 子节点列表。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * Dependency RuntimeNode，持有动态 renderer 的执行状态和产出的子树。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @remarks
 * Dependency 不使用 `childNodes`，renderer 返回的结构存放在 `dynamicChildNodes`，
 * 以便和 group 的静态 children 语义区分开。
 */
export interface DependencyRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  /**
   * RuntimeNode 类型标识，表示动态 dependency 节点。
   */
  readonly type: "dependency"

  /**
   * dependency 对应的编译后描述符。
   */
  descriptor: DependencyDescriptor<TValues>

  /**
   * renderer effect 的可观察执行状态。
   */
  dependencySlot: DependencyEffectSlot | null

  /**
   * 当前 renderer effect、trigger 订阅和 abort 清理的生命周期边界。
   */
  dependencyResourceScope: Scope | null

  /**
   * dependency renderer 产出的 runtime 子树。
   */
  dynamicChildNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * Runtime node 中所有 RuntimeNode 节点的联合类型。
 *
 * @typeParam TValues - 表单值类型。
 */
export type RuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 除 root 外，所有带 descriptor 的 RuntimeNode。
 *
 * @typeParam TValues - 表单值类型。
 */
export type DescribedRuntimeNode<TValues extends Values = Values> =
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 可承载 runtime 子节点的 RuntimeNode。
 *
 * @remarks
 * Root 和 Group 使用 `childNodes`，Dependency 使用 `dynamicChildNodes`。
 *
 * @typeParam TValues - 表单值类型。
 */
export type ContainerRuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 判断 RuntimeNode 是否带有表单描述符。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns 非 root 节点时返回 true，并收窄为带 descriptor 的 RuntimeNode。
 */
export function hasDescriptor<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is DescribedRuntimeNode<TValues> {
  return node.type !== "root"
}

/**
 * 判断 RuntimeNode 是否为根 RuntimeNode。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns 根节点时返回 true。
 */
export function isRootRuntimeNode<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is RootRuntimeNode<TValues> {
  return node.type === "root"
}

/**
 * 判断 RuntimeNode 是否为字段 RuntimeNode。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns 字段节点时返回 true。
 */
export function isFieldRuntimeNode<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is FieldRuntimeNode<TValues> {
  return node?.type === "field"
}

/**
 * 判断 RuntimeNode 是否为分组 RuntimeNode。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns 分组节点时返回 true。
 */
export function isGroupRuntimeNode<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is GroupRuntimeNode<TValues> {
  return node?.type === "group"
}

/**
 * 判断 RuntimeNode 是否为 dependency RuntimeNode。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns dependency 节点时返回 true。
 */
export function isDependencyRuntimeNode<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is DependencyRuntimeNode<TValues> {
  return node?.type === "dependency"
}

/**
 * 判断 RuntimeNode 是否可以承载 runtime 子节点。
 *
 * @param node - 待判断的 runtime 节点。
 * @returns root、group 或 dependency 节点时返回 true。
 */
export function isContainerRuntimeNode<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): node is ContainerRuntimeNode<TValues> {
  return node.type === "root" || node.type === "group" || node.type === "dependency"
}

/**
 * 读取容器 RuntimeNode 的 runtime 子节点。
 *
 * @remarks
 * 这个 helper 隐藏了 `GroupRuntimeNode.childNodes` 与 `DependencyRuntimeNode.dynamicChildNodes`
 * 的存储差异，调用方不需要把两种子树语义揉在一起处理。
 *
 * @param node - 容器节点。
 * @returns 当前 runtime 子节点数组。
 */
export function getChildRuntimeNodes<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): DescribedRuntimeNode<TValues>[] {
  if (isRootRuntimeNode(node) || isGroupRuntimeNode(node)) {
    return node.childNodes
  }

  if (isDependencyRuntimeNode(node)) {
    return node.dynamicChildNodes
  }

  return []
}

/**
 * 替换容器 RuntimeNode 的 runtime 子节点。
 *
 * @remarks
 * 仅用于 reconcile 提交结构结果；字段 RuntimeNode 没有 runtime 子节点。
 *
 * @param node - 容器节点。
 * @param children - 下一组 runtime 子节点。
 */
export function setChildRuntimeNodes<TValues extends Values = Values>(
  node: RuntimeNode<TValues>,
  children: DescribedRuntimeNode<TValues>[]
): void {
  if (isRootRuntimeNode(node) || isGroupRuntimeNode(node)) {
    node.childNodes = children

    return
  }

  if (isDependencyRuntimeNode(node)) {
    node.dynamicChildNodes = children

    return
  }
}

/**
 * 在 RuntimeNode 子树中按字段名称查找字段 RuntimeNode。
 *
 * 使用 BFS 从给定的根 RuntimeNode 开始搜索，返回第一个
 * `descriptor.name` 与目标名称匹配的 FieldRuntimeNode。
 *
 * @param root - 搜索起点的根 RuntimeNode。
 * @param name - 要查找的字段路径。
 *
 * @returns 匹配的 FieldRuntimeNode，未找到时返回 undefined。
 *
 * @example
 * ```ts
 * const fieldNode = findFieldRuntimeNode(root, "user.name")
 * if (fieldNode) {
 *   console.log(fieldNode.descriptor.schema)
 * }
 * ```
 */
export function findFieldRuntimeNode<TValues extends Values = Values>(
  root: RuntimeNode<TValues>,
  name: NamePath<TValues>
): FieldRuntimeNode<TValues> | undefined {
  return findNodeBFS<RuntimeNode<TValues>>(
    root,
    (node) => isFieldRuntimeNode(node) && node.descriptor.name === name,
    {
      getChildren: (node) => getChildRuntimeNodes(node),
    }
  ) as FieldRuntimeNode<TValues> | undefined
}
