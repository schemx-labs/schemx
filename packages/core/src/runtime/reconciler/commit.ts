/**
 * commit 阶段 —— 执行协调计划，将差异变更应用到运行时节点树。
 *
 * commit 阶段按严格顺序执行以下步骤：
 * 1. 创建新节点（不触发 mount）
 * 2. 按目标顺序组装子节点列表
 * 3. 触发已有节点的 update 生命周期
 * 4. 触发新节点的 mount 生命周期
 * 5. 将组装好的子节点列表替换到父节点
 * 6. 卸载并删除已被移除的节点
 *
 * 这个顺序确保：
 * - 子节点替换前所有新节点已准备好、旧节点已更新
 * - 替换后立即清理已移除节点，避免悬空引用
 *
 * @module core/runtime/reconciler/commit
 */

import type { Values } from "../../types"
import type { DescribedRuntimeNode } from "../node"
import type { ContainerRuntimeNode } from "../node"
import type { CommitReconcilePlanOptions, ReconcilePlan } from "./types"

/**
 * 提交并执行协调计划。
 *
 * @typeParam TValues - 表单值类型
 * @param parent - 容器型父节点
 * @param plan - 协调计划
 * @param options - 节点管理器和生命周期
 * @returns 按目标顺序排列的子节点列表
 */
export function commitReconcilePlan<TValues extends Values = Values>(
  parent: ContainerRuntimeNode<TValues>,
  plan: ReconcilePlan<TValues>,
  options: CommitReconcilePlanOptions<TValues>
): readonly DescribedRuntimeNode<TValues>[] {
  // 记录新创建的节点，供后续挂载和顺序组装使用
  const createdByKey = new Map<string, DescribedRuntimeNode<TValues>>()

  // 第一步：创建所有新节点（尚未挂载）
  for (const { descriptor } of plan.creates) {
    const node = options.nodeManager.createNode({
      type: descriptor.type,
      key: descriptor.key,
      parent,
      // 新节点从父节点继承 dispose 句柄，确保生命周期与父节点绑定
      dispose: parent.dispose.child(),
    })

    createdByKey.set(descriptor.key, node)
  }

  // 第二步：按目标顺序组装子节点列表
  // 已有节点直接复用，新节点从 createdByKey 中查找
  const nextChildren = plan.nextChildrenOrder.map((entry) => {
    if (entry.node) {
      return entry.node
    }

    const created = createdByKey.get(entry.descriptor.key)

    if (!created) {
      throw new Error(
        `[schemx] Missing created runtime node for descriptor "${entry.descriptor.key}".`
      )
    }

    return created
  })

  // 第三步：触发已有节点的 update 生命周期
  for (const { node, previousDescriptor, nextDescriptor } of plan.updates) {
    options.lifecycle.update(node, previousDescriptor, nextDescriptor)
  }

  // 第四步：触发新节点的 mount 生命周期
  for (const { descriptor } of plan.creates) {
    const node = createdByKey.get(descriptor.key)

    if (!node) {
      throw new Error(
        `[schemx] Missing mounted runtime node for descriptor "${descriptor.key}".`
      )
    }

    options.lifecycle.mount(node, descriptor)
  }

  // 第五步：将子节点列表替换到父节点
  options.nodeManager.replaceChildren(parent, nextChildren)

  // 第六步：卸载并删除已移除的节点
  for (const { node } of plan.removes) {
    options.lifecycle.unmountSubtree(node)
    options.nodeManager.removeSubtree(node)
  }

  return nextChildren
}
