/**
 * Reconciler 类型定义 —— 表单 Schema 协调器的类型系统。
 *
 * Reconciler 负责将 FormDescriptor 树同步到 RuntimeNode 树，包含三个步骤：
 * - plan：对比新旧 descriptor 列表，生成差异计划（创建/更新/删除/排序）
 * - commit：按计划执行节点创建、挂载、更新、卸载、删除
 * - create：组装 plan + commit 为完整的 Reconciler 实例
 *
 * @module core/runtime/reconciler/types
 */

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FormDescriptor } from "../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeManager,
} from "../node"
import type { RuntimeLifecycle } from "../node/runtimeLifecycle"

/**
 * 创建节点操作。
 *
 * 表示需要依据给定的 descriptor 创建一个新的运行时节点。
 *
 * @typeParam TValues - 表单值类型
 */
export interface ReconcileCreateOperation<TValues extends Values = Values> {
  /**
   * 待创建节点对应的 descriptor
   */
  readonly descriptor: FormDescriptor<TValues>
}

/**
 * 更新节点操作。
 *
 * 表示某个已有节点的 descriptor 发生了变化，需要触发更新生命周期。
 *
 * @typeParam TValues - 表单值类型
 */
export interface ReconcileUpdateOperation<TValues extends Values = Values> {
  /**
   * 需要更新的已有运行时节点
   */
  readonly node: DescribedRuntimeNode<TValues>
  /**
   * 更新前的旧 descriptor（首次更新时为 null）
   */
  readonly previousDescriptor: FormDescriptor<TValues> | null
  /**
   * 更新后的新 descriptor
   */
  readonly nextDescriptor: FormDescriptor<TValues>
}

/**
 * 移除节点操作。
 *
 * 表示某个已有节点在最新 schema 中已不存在，需要卸载并删除。
 *
 * @typeParam TValues - 表单值类型
 */
export interface ReconcileRemoveOperation<TValues extends Values = Values> {
  /**
   * 待移除的运行时节点
   */
  readonly node: DescribedRuntimeNode<TValues>
}

/**
 * 子节点排序条目。
 *
 * 记录协调后父节点下每个子节点应该处于的位置。
 * 已有节点复用（node 存在）与新创建节点（仅 descriptor）统一由该条目表示。
 *
 * @typeParam TValues - 表单值类型
 */
export interface ReconcileChildOrderEntry<TValues extends Values = Values> {
  /**
   * 子节点对应的 descriptor
   */
  readonly descriptor: FormDescriptor<TValues>
  /**
   * 可复用的已有节点；不存在表示该条目对应一个新创建节点
   */
  readonly node?: DescribedRuntimeNode<TValues>
}

/**
 * 协调计划。
 *
 * plan 阶段的产物，描述从当前子节点列表过渡到目标子节点列表所需的全部操作：
 * - creates：需要新建的节点列表
 * - updates：需要更新 descriptor 的节点列表
 * - removes：需要删除的节点列表
 * - nextChildrenOrder：目标子节点顺序，供 commit 阶段排序
 *
 * @typeParam TValues - 表单值类型
 */
export interface ReconcilePlan<TValues extends Values = Values> {
  /**
   * 需要创建的节点操作列表
   */
  readonly creates: readonly ReconcileCreateOperation<TValues>[]
  /**
   * 需要更新的节点操作列表
   */
  readonly updates: readonly ReconcileUpdateOperation<TValues>[]
  /**
   * 需要移除的节点操作列表
   */
  readonly removes: readonly ReconcileRemoveOperation<TValues>[]
  /**
   * 目标子节点顺序
   */
  readonly nextChildrenOrder: readonly ReconcileChildOrderEntry<TValues>[]
}

/**
 * commit 阶段所需的节点管理器接口。
 *
 * 从 RuntimeNodeManager 中选取 commit 阶段需要的能力：
 * 创建节点、替换子节点列表、移除子树。
 *
 * @typeParam TValues - 表单值类型
 */
export type ReconcileNodeManager<TValues extends Values = Values> = Pick<
  RuntimeNodeManager<TValues>,
  "createNode" | "replaceChildren" | "removeSubtree"
>

/**
 * commitReconcilePlan 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CommitReconcilePlanOptions<TValues extends Values = Values> {
  /**
   * 节点管理器，负责创建/替换/删除运行时节点
   */
  readonly nodeManager: ReconcileNodeManager<TValues>
  /**
   * 运行时生命周期，负责挂载/更新/卸载钩子
   */
  readonly lifecycle: RuntimeLifecycle<TValues>
}

/**
 * Reconciler 接口 —— 表单 Schema 协调器对外暴露的能力。
 *
 * @typeParam TValues - 表单值类型
 */
export interface Reconciler<TValues extends Values = Values> {
  /**
   * 创建根运行时节点。
   *
   * @returns 根运行时节点
   */
  createRoot(): RootRuntimeNode<TValues>

  /**
   * 协调父节点下的子节点。
   *
   * 对比 parent 当前子节点列表与 nextDescriptors，执行差异协调。
   * 递归处理 group 类型节点的子节点。
   *
   * @param parent - 容器型父节点
   * @param nextDescriptors - 目标子节点 descriptor 列表
   */
  reconcileChildren(
    parent: ContainerRuntimeNode<TValues>,
    nextDescriptors: readonly FormDescriptor<TValues>[]
  ): void

  /**
   * 更新单个节点的 descriptor。
   *
   * @param node - 需要更新的运行时节点
   * @param nextDescriptor - 新的 descriptor
   */
  updateNode(
    node: DescribedRuntimeNode<TValues>,
    nextDescriptor: FormDescriptor<TValues>
  ): void

  /**
   * 移除单个节点。
   *
   * @param node - 需要移除的运行时节点
   */
  removeNode(node: RuntimeNode<TValues>): void
}

/**
 * 创建 Reconciler 所需的上下文。
 *
 * 当前直接使用 SchemaRuntimeContext，预留别名以便后续扩展。
 *
 * @typeParam TValues - 表单值类型
 */
export type CreateReconcilerContext<TValues extends Values = Values> =
  SchemaRuntimeContext<TValues>
