/**
 * Lifecycle - RuntimeNode 生命周期事件总线。
 *
 * Reconciler 负责决定 RuntimeNode 的创建、复用和销毁，RuntimeNodeManager 负责执行单个
 * RuntimeNode 的生命周期动作。LifecycleBus 只观察 RuntimeNode 生命周期，不参与内部资源挂载。
 *
 * @module core/lifecycle
 *
 * @example
 * ```ts
 * import { createLifecycleBus, createLifecycle } from '@schemx/core'
 *
 * // 创建生命周期总线
 * const bus = createLifecycleBus()
 *
 * // 订阅生命周期事件
 * const dispose = bus.on({
 *   // 旧版兼容接口
 *   mount: (node) => console.log('挂载:', node),
 *   update: (node, prev) => console.log('更新:', node),
 *   unmount: (node) => console.log('卸载:', node),
 *
 *   // 新版详细接口
 *   beforeMount: (node) => console.log('即将挂载:', node),
 *   mounted: (node) => console.log('已挂载:', node),
 *   beforeUpdate: (node, prev) => console.log('即将更新:', node),
 *   updated: (node, prev) => console.log('已更新:', node),
 *   beforeUnmount: (node) => console.log('即将卸载:', node),
 *   unmounted: (node) => console.log('已卸载:', node)
 * })
 *
 * // 发布事件（通常由内部调用）
 * bus.emitMount(someNode)
 * bus.emitBeforeMount(someNode)
 * bus.emitUpdate(someNode, prevNode)
 * bus.emitBeforeUpdate(someNode, prevNode)
 * bus.emitUpdated(someNode, prevNode)
 * bus.emitBeforeUnmount(someNode)
 * bus.emitUnmount(someNode)
 *
 * // 检查是否有监听器
 * // 清理所有监听器
 * bus.clear()
 *
 * // 取消订阅
 * dispose()
 * ```
 *
 * @example
 * ```ts
 * // 在 createForm 中使用
 * const form = createForm({
 *   schemas: [...],
 *   lifecycleHooks: {
 *     mounted: (node) => {
 *       console.log('字段已挂载:', node.descriptor.name)
 *     },
 *     unmounted: (node) => {
 *       console.log('字段已卸载:', node.descriptor.name)
 *     }
 *   }
 * })
 * ```
 */

import type { RuntimeNode } from "../node"
import type { Values } from "../types"

/**
 * 兼容旧命名的完整生命周期 hooks。
 */
export interface LifecycleHooks<TNode> {
  /**
   * 挂载新节点。
   *
   * @param node - 被挂载的节点。
   */
  mount(node: TNode): void

  /**
   * 更新已有节点。
   *
   * @param node - 被更新的节点。
   * @param previousNode - 更新前的节点快照。
   */
  update(node: TNode, previousNode: TNode): void

  /**
   * 卸载节点。
   *
   * @param node - 被卸载的节点。
   */
  unmount(node: TNode): void
}

/**
 * RuntimeNode 生命周期 hooks。
 */
export interface RuntimeNodeLifecycleHooks<TNode> {
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
 * 生命周期事件监听器。
 *
 * 监听器允许只实现关心的事件。mount/update/unmount 是兼容旧命名的观察入口，
 * mounted/updated/unmounted 是新的 RuntimeNode 生命周期入口。
 */
export type LifecycleListener<TNode> = Partial<
  LifecycleHooks<TNode> & RuntimeNodeLifecycleHooks<TNode>
>

/**
 * 生命周期事件总线。
 *
 * @example
 * ```ts
 * const bus: LifecycleBus<MyNode> = createLifecycleBus()
 *
 * // 订阅
 * const dispose = bus.on({
 *   mounted: (node) => console.log('Mounted:', node),
 *   unmounted: (node) => console.log('Unmounted:', node)
 * })
 *
 * // 发布
 * bus.emitMount(node)
 * bus.emitBeforeMount(node)
 * bus.emitUpdate(node, prev)
 * bus.emitBeforeUpdate(node, prev)
 * bus.emitUpdated(node, prev)
 * bus.emitBeforeUnmount(node)
 * bus.emitUnmount(node)
 *
 * // 清理
 * bus.clear()
 * dispose()
 * ```
 */
export interface LifecycleBus<TNode> {
  /**
   * 订阅生命周期事件。
   *
   * @param listener - 生命周期事件监听器。
   * @returns 取消订阅函数
   */
  on(listener: LifecycleListener<TNode>): () => void

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
   * 发布 update 事件。
   *
   * @param node - 被更新的节点。
   * @param previousNode - 更新前的节点快照。
   */
  emitUpdate(node: TNode, previousNode: TNode): void

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

  /**
   * 移除所有监听器。
   */
  clear(): void
}

/**
 * 表单内部生命周期 hooks。
 *
 * 这些 hook 由 createForm 传入，用于在表单内部资源装配后
 * 观察字段、分组和 dependency 节点的 mount/update/unmount。
 */
export type SchemxLifecycleHooks<TValues extends Values = Values> = LifecycleListener<
  RuntimeNode<TValues>
>

/**
 * 创建生命周期事件总线。
 *
 * listener 按订阅顺序执行。发布事件前会复制 listener 快照，避免某个 listener
 * 在回调中订阅/取消订阅影响当前事件分发。
 *
 * @param initialListener - 可选的初始监听器。
 * @returns 新的生命周期事件总线。
 *
 * @example
 * ```ts
 * // 创建空总线
 * const bus = createLifecycleBus()
 *
 * // 创建并立即订阅
 * const bus = createLifecycleBus({
 *   mounted: (node) => console.log('Node mounted:', node)
 * })
 *
 * // 后续再订阅
 * const dispose = bus.on({
 *   unmounted: (node) => console.log('Node unmounted:', node)
 * })
 * ```
 */
export function createLifecycleBus<TNode>(
  initialListener?: LifecycleListener<TNode>
): LifecycleBus<TNode> {
  const listeners = new Set<LifecycleListener<TNode>>()

  if (initialListener) {
    listeners.add(initialListener)
  }

  /**
   * 按监听器快照分发生命周期事件。
   */
  const emit = <TArgs extends unknown[]>(
    run: (listener: LifecycleListener<TNode>, ...args: TArgs) => void,
    ...args: TArgs
  ): void => {
    for (const listener of Array.from(listeners)) {
      run(listener, ...args)
    }
  }

  /**
   * 订阅生命周期事件。
   */
  const on = (listener: LifecycleListener<TNode>) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  /**
   * 发布 mount 事件。
   */
  const emitMount = (node: TNode) => {
    emit((listener, currentNode) => {
      listener.mount?.(currentNode)
      listener.mounted?.(currentNode)
    }, node)
  }

  /**
   * 发布 beforeMount 事件。
   */
  const emitBeforeMount = (node: TNode) => {
    emit((listener, currentNode) => {
      listener.beforeMount?.(currentNode)
    }, node)
  }

  /**
   * 发布 update 事件。
   */
  const emitUpdate = (node: TNode, previousNode: TNode) => {
    emit(
      (listener, currentNode, currentPreviousNode) => {
        listener.update?.(currentNode, currentPreviousNode)
      },
      node,
      previousNode
    )
  }

  /**
   * 发布 beforeUpdate 事件。
   */
  const emitBeforeUpdate = (node: TNode, previousNode: TNode) => {
    emit(
      (listener, currentNode, currentPreviousNode) => {
        listener.beforeUpdate?.(currentNode, currentPreviousNode)
      },
      node,
      previousNode
    )
  }

  /**
   * 发布 updated 事件。
   */
  const emitUpdated = (node: TNode, previousNode: TNode) => {
    emit(
      (listener, currentNode, currentPreviousNode) => {
        listener.updated?.(currentNode, currentPreviousNode)
      },
      node,
      previousNode
    )
  }

  /**
   * 发布 beforeUnmount 事件。
   */
  const emitBeforeUnmount = (node: TNode) => {
    emit((listener, currentNode) => {
      listener.beforeUnmount?.(currentNode)
    }, node)
  }

  /**
   * 发布 unmount 事件。
   */
  const emitUnmount = (node: TNode) => {
    emit((listener, currentNode) => {
      listener.unmount?.(currentNode)
      listener.unmounted?.(currentNode)
    }, node)
  }

  /**
   * 移除所有监听器。
   */
  const clear = () => {
    listeners.clear()
  }

  return {
    on,
    emitMount,
    emitBeforeMount,
    emitUpdate,
    emitBeforeUpdate,
    emitUpdated,
    emitBeforeUnmount,
    emitUnmount,
    clear,
  }
}

/**
 * 兼容旧命名：创建生命周期事件总线。
 */
export const createLifecycle = createLifecycleBus
