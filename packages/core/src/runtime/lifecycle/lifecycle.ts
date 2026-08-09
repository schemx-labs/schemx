/**
 * Lifecycle - RuntimeNode 生命周期 hooks dispatcher。
 *
 * Reconciler 负责决定 RuntimeNode 的创建、复用和销毁，RuntimeNodeManager 负责执行单个
 * RuntimeNode 的生命周期动作。LifecycleBus 只分发创建 Runtime 时固定的 hooks，不参与内部资源挂载。
 *
 * @module core/runtime/lifecycle
 *
 * @example
 * ```ts
 * import { createLifecycleBus } from '@schemx/core'
 *
 * const bus = createLifecycleBus({
 *   mounted: (node) => console.log('已挂载:', node),
 * })
 *
 * // 分发生命周期事件（仅 Runtime 内部调用）
 * bus.emitMount(someNode)
 * bus.emitBeforeMount(someNode)
 * bus.emitBeforeUpdate(someNode, prevNode)
 * bus.emitUpdated(someNode, prevNode)
 * bus.emitBeforeUnmount(someNode)
 * bus.emitUnmount(someNode)
 *
 * ```
 *
 * @example
 * ```ts
 * // 在 createForm 中使用
 * const form = createForm({
 *   schemas: [...],
 *   lifecycleHooks: {
 *     mounted: (node) => {
 *       console.log('节点已挂载:', node.key)
 *     },
 *     unmounted: (node) => {
 *       console.log('节点已卸载:', node.key)
 *     }
 *   }
 * })
 * ```
 */

/**
 * RuntimeNode 生命周期 hooks。
 */
export interface LifecycleHooks<TNode> {
  /**
   * RuntimeNode 挂载前。
   *
   * @param node - 即将挂载的 RuntimeNode 节点。
   */
  beforeMount(node: TNode): void

  /**
   * RuntimeNode 挂载后。
   *
   * @param node - 已挂载的 RuntimeNode 节点。
   */
  mounted(node: TNode): void

  /**
   * RuntimeNode 更新前。
   *
   * @param node - 即将更新的 RuntimeNode 节点。
   * @param previousNode - 更新前的 RuntimeNode 快照。
   */
  beforeUpdate(node: TNode, previousNode: TNode): void

  /**
   * RuntimeNode 更新后。
   *
   * @param node - 已更新的 RuntimeNode 节点。
   * @param previousNode - 更新前的 RuntimeNode 快照。
   */
  updated(node: TNode, previousNode: TNode): void

  /**
   * RuntimeNode 卸载前。
   *
   * @param node - 即将卸载的 RuntimeNode 节点。
   */
  beforeUnmount(node: TNode): void

  /**
   * RuntimeNode 卸载后。
   *
   * @param node - 已卸载的 RuntimeNode 节点。
   */
  unmounted(node: TNode): void
}

/**
 * Runtime 创建时提供的生命周期 hooks。
 *
 * 监听器允许只实现关心的事件。
 */
export type LifecycleListener<TNode> = Partial<LifecycleHooks<TNode>>

/**
 * 生命周期 hooks dispatcher。
 *
 * @example
 * ```ts
 * const bus: LifecycleBus<MyNode> = createLifecycleBus({
 *   mounted: (node) => console.log('Mounted:', node),
 * })
 *
 * // 仅 Runtime 内部发布
 * bus.emitMount(node)
 * bus.emitBeforeMount(node)
 * bus.emitBeforeUpdate(node, prev)
 * bus.emitUpdated(node, prev)
 * bus.emitBeforeUnmount(node)
 * bus.emitUnmount(node)
 *
 * ```
 */
export interface LifecycleBus<TNode> {
  /**
   * 发布 mount 事件。
   *
   * @param node - 被挂载的节点。
   */
  emitMount(node: TNode): void

  /**
   * 发布 beforeMount 事件。
   *
   * @param node - 即将挂载的节点。
   */
  emitBeforeMount(node: TNode): void

  /**
   * 发布 beforeUpdate 事件。
   *
   * @param node - 即将更新的节点。
   * @param previousNode - 更新前的节点快照。
   */
  emitBeforeUpdate(node: TNode, previousNode: TNode): void

  /**
   * 发布 updated 事件。
   *
   * @param node - 已更新的节点。
   * @param previousNode - 更新前的节点快照。
   */
  emitUpdated(node: TNode, previousNode: TNode): void

  /**
   * 发布 beforeUnmount 事件。
   *
   * @param node - 即将卸载的节点。
   */
  emitBeforeUnmount(node: TNode): void

  /**
   * 发布 unmount 事件。
   *
   * @param node - 被卸载的节点。
   */
  emitUnmount(node: TNode): void

}

/**
 * 创建生命周期事件总线。
 *
 * hooks 在 Runtime 创建时固定。单个 hook 的异常会被隔离，不能中断节点事务或资源释放。
 *
 * @param initialListener - 可选的初始监听器。
 * @returns 新的生命周期事件总线。
 *
 * @example
 * ```ts
 * const bus = createLifecycleBus({
 *   mounted: (node) => console.log('Node mounted:', node)
 * })
 * ```
 */
export function createLifecycleBus<TNode>(
  initialListener?: LifecycleListener<TNode>
): LifecycleBus<TNode> {
  /**
   * 隔离 hook 异常，避免观察性代码中断 Runtime 事务。
   */
  const dispatch = <TArgs extends unknown[]>(
    hook: ((...args: TArgs) => void) | undefined,
    ...args: TArgs
  ): void => {
    if (!hook) {
      return
    }

    try {
      hook(...args)
    } catch (error) {
      console.error("[schemx] Runtime lifecycle hook 执行错误", error)
    }
  }

  /**
   * 发布 mount 事件。
   */
  const emitMount = (node: TNode) => {
    dispatch(initialListener?.mounted, node)
  }

  /**
   * 发布 beforeMount 事件。
   */
  const emitBeforeMount = (node: TNode) => {
    dispatch(initialListener?.beforeMount, node)
  }

  /**
   * 发布 beforeUpdate 事件。
   */
  const emitBeforeUpdate = (node: TNode, previousNode: TNode) => {
    dispatch(initialListener?.beforeUpdate, node, previousNode)
  }

  /**
   * 发布 updated 事件。
   */
  const emitUpdated = (node: TNode, previousNode: TNode) => {
    dispatch(initialListener?.updated, node, previousNode)
  }

  /**
   * 发布 beforeUnmount 事件。
   */
  const emitBeforeUnmount = (node: TNode) => {
    dispatch(initialListener?.beforeUnmount, node)
  }

  /**
   * 发布 unmount 事件。
   */
  const emitUnmount = (node: TNode) => {
    dispatch(initialListener?.unmounted, node)
  }

  return {
    emitMount,
    emitBeforeMount,
    emitBeforeUpdate,
    emitUpdated,
    emitBeforeUnmount,
    emitUnmount,
  }
}
