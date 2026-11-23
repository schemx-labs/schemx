/**
 * Reconciler - 结构复用引擎。
 *
 * Reconciler 只处理结构复用，不理解 descriptor 的领域含义，
 * 也不发布生命周期事件。
 *
 * @module core/node/reconciler
 */

import { isGroupDescriptor } from "../descriptor"

import { getChildRuntimeNodes, setChildRuntimeNodes } from "./runtimeNode"

import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  GroupRuntimeNode,
} from "./runtimeNode"
import type { FormDescriptor } from "../descriptor"
import type { Values } from "../types"
import type { RuntimeNodeManager } from "./runtimeNodeManager"

/**
 * 默认的 keyed runtime node reconciler。
 *
 * @typeParam TValues - 表单值类型。
 */
class RuntimeReconciler<TValues extends Values> {
  /** 执行 RuntimeNode 创建、挂载、更新和销毁的生命周期管理器。 */
  private runtimeNodeManager: RuntimeNodeManager<TValues>

  constructor(runtimeNodeManager: RuntimeNodeManager<TValues>) {
    this.runtimeNodeManager = runtimeNodeManager
  }

  /**
   * 将容器 RuntimeNode 的子节点更新为目标 descriptor 列表。
   *
   * @param parentNode - 承载子节点的 RuntimeNode。
   * @param descriptors - 新一轮编译后的子节点描述符。
   * @returns 子节点结构是否发生可观测变化（新增、移除、类型变更或子树变动）。
   *
   * @remarks
   * 同 key 且同 type 的 RuntimeNode 会被复用；不同 type 即使 key 相同也会重建。
   * 新子节点会先提交到 parent，再销毁被移除的旧节点，避免 cleanup 或视图投影
   * 期间仍读取到过期结构。`viewRevision` 由外层 commit boundary 统一推进。
   */
  reconcileChildren(
    parentNode: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): boolean {
    return this.reconcileChildrenTree(parentNode, descriptors)
  }

  private reconcileChildrenTree(
    parentNode: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): boolean {
    const previousByKey = new Map(
      getChildRuntimeNodes(parentNode).map((node) => [node.key, node])
    )

    const next: DescribedRuntimeNode<TValues>[] = []

    const groups: Array<{
      node: GroupRuntimeNode<TValues>
      descriptor: FormDescriptor<TValues>
    }> = []

    let changed = false

    for (const descriptor of descriptors) {
      const existingNode = previousByKey.get(descriptor.key)

      // TODO: diff schema是否有变更
      if (existingNode && existingNode.type === descriptor.type) {
        previousByKey.delete(descriptor.key)

        existingNode.parent = parentNode

        this.runtimeNodeManager.update(existingNode, descriptor)

        next.push(existingNode)

        if (isGroupDescriptor(descriptor)) {
          groups.push({ node: existingNode as GroupRuntimeNode<TValues>, descriptor })
        }

        continue
      }

      // 新建或类型变更
      changed = true

      const node = this.runtimeNodeManager.create(descriptor, parentNode)

      this.runtimeNodeManager.mount(node)

      next.push(node)

      if (isGroupDescriptor(descriptor)) {
        groups.push({ node: node as GroupRuntimeNode<TValues>, descriptor })
      }
    }

    // 先提交新结构，避免 cleanup 或投影期间仍遍历旧子树。
    setChildRuntimeNodes(parentNode, next)

    for (const { node, descriptor } of groups) {
      if (isGroupDescriptor(descriptor)) {
        if (this.reconcileChildrenTree(node, descriptor.children)) {
          changed = true
        }
      }
    }

    if (previousByKey.size > 0) {
      changed = true
    }

    for (const removed of previousByKey.values()) {
      this.runtimeNodeManager.disposeTree(removed)
    }

    return changed
  }
}

/**
 * Reconciler 的实例类型。
 */
export type Reconciler<TValues extends Values> = InstanceType<
  typeof RuntimeReconciler<TValues>
>

/**
 * 创建默认 Reconciler。
 *
 * @param runtimeNodeManager - 执行 RuntimeNode 创建、更新和销毁的生命周期管理器。
 * @returns 新的 Reconciler 实例。
 */
export function createReconciler<TValues extends Values>(
  runtimeNodeManager: RuntimeNodeManager<TValues>
): Reconciler<TValues> {
  return new RuntimeReconciler(runtimeNodeManager)
}
