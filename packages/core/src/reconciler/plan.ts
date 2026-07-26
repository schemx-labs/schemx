/**
 * plan 阶段 —— 对比新旧子节点列表，生成差异协调计划。
 *
 * 核心职责：对比 parent 当前子节点（DescribedRuntimeNode[]）与目标 descriptor 列表，
 * 通过 key 匹配找出需要创建、更新、删除的节点，并确定最终子节点顺序。
 * 该阶段不操作 DOM 或运行时节点，只输出 ReconcilePlan。
 *
 * 复用策略：仅当节点 type 与 descriptor type 一致时复用已有节点。
 * type 不同意味着结构变更，必须重建。
 *
 * @module core/reconciler/plan
 */

import type { FormDescriptor } from "../descriptor"
import type { DescribedRuntimeNode } from "../node"
import type { Values } from "../types"
import type {
  ReconcileChildOrderEntry,
  ReconcileCreateOperation,
  ReconcilePlan,
  ReconcileRemoveOperation,
  ReconcileUpdateOperation,
} from "./types"

/**
 * 创建协调计划。
 *
 * 两步式 diff：
 * 1. 遍历目标 descriptors，匹配可复用的已有节点；不可复用则标记创建。
 * 2. 遍历当前节点，找出在目标中不存在或 type 变更的节点标记删除。
 *
 * @typeParam TValues - 表单值类型
 * @param currentChildren - 当前父节点下的子节点列表
 * @param nextDescriptors - 目标 descriptor 列表
 * @returns 协调计划，包含创建/更新/删除操作及目标顺序
 */
export function createReconcilePlan<TValues extends Values = Values>(
  currentChildren: readonly DescribedRuntimeNode<TValues>[],
  nextDescriptors: readonly FormDescriptor<TValues>[]
): ReconcilePlan<TValues> {
  // 以 key 为索引建立快速查找表
  const currentByKey = indexNodesByKey(currentChildren)

  const nextByKey = indexDescriptorsByKey(nextDescriptors)

  const creates: ReconcileCreateOperation<TValues>[] = []

  const updates: ReconcileUpdateOperation<TValues>[] = []

  const removes: ReconcileRemoveOperation<TValues>[] = []

  const nextChildrenOrder: ReconcileChildOrderEntry<TValues>[] = []

  // 第一遍：遍历目标 descriptors，确定创建和更新
  for (const descriptor of nextDescriptors) {
    const existing = currentByKey.get(descriptor.key)

    // 节点不存在或 type 不匹配时，创建新节点
    if (!existing || !canReuse(existing, descriptor)) {
      creates.push({ descriptor })
      nextChildrenOrder.push({ descriptor })
      continue
    }

    // 节点可复用但 descriptor 引用不同时，标记更新
    const previousDescriptor = existing.descriptor

    if (previousDescriptor !== descriptor) {
      updates.push({
        node: existing,
        previousDescriptor,
        nextDescriptor: descriptor,
      })
    }

    // 复用节点加入目标顺序
    nextChildrenOrder.push({ descriptor, node: existing })
  }

  // 第二遍：遍历当前节点，找出需要删除的
  for (const child of currentChildren) {
    const nextDescriptor = nextByKey.get(child.key)

    // 目标中不存在或 type 变更导致无法复用 → 删除
    if (!nextDescriptor || !canReuse(child, nextDescriptor)) {
      removes.push({ node: child })
    }
  }

  return {
    creates,
    updates,
    removes,
    nextChildrenOrder,
  }
}

/**
 * 判断节点能否复用。
 *
 * 复用条件：节点 type 与 descriptor type 一致。
 * type 不同意味着表单结构（如字段类型从 input 变为 select）发生了根本变化，
 * 必须销毁重建而非原地更新。
 *
 * @param node - 已有运行时节点
 * @param descriptor - 目标 descriptor
 * @returns 能否复用
 */
function canReuse<TValues extends Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>
): boolean {
  return node.type === descriptor.type
}

/**
 * 以 key 为索引建立当前节点的查找表。
 *
 * @param nodes - 节点列表
 * @returns key → 节点的 Map
 */
function indexNodesByKey<TValues extends Values>(
  nodes: readonly DescribedRuntimeNode<TValues>[]
): Map<string, DescribedRuntimeNode<TValues>> {
  const result = new Map<string, DescribedRuntimeNode<TValues>>()

  for (const node of nodes) {
    if (result.has(node.key)) {
      throw new Error(`[schemx] Duplicate runtime node key "${node.key}".`)
    }

    result.set(node.key, node)
  }

  return result
}

/**
 * 以 key 为索引建立目标 descriptor 的查找表。
 *
 * @param descriptors - descriptor 列表
 * @returns key → descriptor 的 Map
 */
function indexDescriptorsByKey<TValues extends Values>(
  descriptors: readonly FormDescriptor<TValues>[]
): Map<string, FormDescriptor<TValues>> {
  const result = new Map<string, FormDescriptor<TValues>>()

  for (const descriptor of descriptors) {
    if (result.has(descriptor.key)) {
      throw new Error(`[schemx] Duplicate descriptor key "${descriptor.key}".`)
    }

    result.set(descriptor.key, descriptor)
  }

  return result
}
