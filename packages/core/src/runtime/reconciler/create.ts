/**
 * create 阶段 —— 组装完整的 Reconciler 实例。
 *
 * Reconciler 的工厂函数，将 plan 阶段（diff 差异计算）和 commit 阶段（执行变更）
 * 组合为统一的协调器接口。同时负责创建运行时所依赖的 nodeManager 和 lifecycle。
 *
 * 对外暴露四个核心能力：
 * - createRoot：创建根节点
 * - reconcileChildren：递归协调子节点
 * - updateNode：更新单个节点的 descriptor
 * - removeNode：移除单个节点
 *
 * @module core/runtime/reconciler/create
 */

import { createRuntimeLifecycle } from "../node/runtimeLifecycle"
import { createRuntimeNodeManager } from "../node/runtimeNodeManager"

import { commitReconcilePlan } from "./commit"
import { createReconcilePlan } from "./plan"

import type { FormDescriptor } from "../descriptor"
import type { CreateReconcilerContext, Reconciler } from "./types"
import type { Values } from "../../types"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
} from "../node/types"

/**
 * 创建 Reconciler 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param context - 创建上下文（当前为 SchemaRuntimeContext，预留扩展）
 * @returns Reconciler 实例
 */
export function createReconciler<TValues extends Values = Values>(
  context: CreateReconcilerContext<TValues>
): Reconciler<TValues> {
  // 初始化运行时基础设施
  const nodeManager = createRuntimeNodeManager<TValues>(context)

  const lifecycle = createRuntimeLifecycle<TValues>(context)

  /**
   * 创建根运行时节点。
   *
   * @returns 根运行时节点
   * @throws 当 nodeManager 不支持创建根节点时抛出
   */
  function createRoot(): RootRuntimeNode<TValues> {
    const createRootNode = nodeManager.createRoot

    if (!createRootNode) {
      throw new Error("[schemx] Reconciler nodeManager cannot create root node.")
    }

    return createRootNode()
  }

  /**
   * 更新单个节点的 descriptor。
   *
   * 引用相同时跳过更新，避免不必要的生命周期触发。
   *
   * @param node - 需要更新的运行时节点
   * @param nextDescriptor - 新的 descriptor
   */
  function updateNode(
    node: DescribedRuntimeNode<TValues>,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    const previousDescriptor = node.descriptor

    // descriptor 引用未变时跳过更新
    if (previousDescriptor === nextDescriptor) {
      return
    }

    lifecycle.update(node, previousDescriptor, nextDescriptor)
  }

  /**
   * 移除单个节点。
   *
   * 先触发卸载生命周期，再删除节点，确保清理钩子得到执行。
   *
   * @param node - 需要移除的运行时节点
   */
  function removeNode(node: RuntimeNode<TValues>): void {
    lifecycle.unmountSubtree(node)
    nodeManager.removeSubtree(node)
  }

  /**
   * 协调父节点下的子节点列表。
   *
   * 1. 读取父节点当前子节点
   * 2. plan 阶段生成差异计划
   * 3. commit 阶段执行计划
   * 4. 递归处理 group 类型子节点（深度优先）
   *
   * @param parent - 容器型父节点
   * @param nextDescriptors - 目标子节点 descriptor 列表
   */
  function reconcileChildren(
    parent: ContainerRuntimeNode<TValues>,
    nextDescriptors: readonly FormDescriptor<TValues>[]
  ): void {
    // 读取当前子节点（从父节点的响应式 childNodes 中获取）
    const currentChildren = parent.childNodes.value

    // plan 阶段：对比当前与目标，生成差异计划
    const plan = createReconcilePlan(currentChildren, nextDescriptors)

    // commit 阶段：执行计划，返回按目标顺序排列的子节点
    const orderedNodes = commitReconcilePlan(parent, plan, { nodeManager, lifecycle })

    // 递归处理 group 类型的子节点，深度优先遍历
    for (const [index, node] of orderedNodes.entries()) {
      const descriptor = nextDescriptors[index]

      if (descriptor?.type === "group" && node.type === "group") {
        reconcileChildren(node, descriptor.children)
      }
    }
  }

  return {
    createRoot,
    reconcileChildren,
    updateNode,
    removeNode,
  }
}
