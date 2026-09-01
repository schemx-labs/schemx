/**
 * RuntimeNode 生命周期事件。
 *
 * 该模块只转发已完成的运行时状态变更，不执行节点资源的挂载、更新或卸载。
 *
 * @module core/runtime/lifecycle
 */

/**
 * RuntimeNode 生命周期 Hook。
 *
 * @typeParam TNode - 运行时节点类型。
 */
export interface RuntimeNodeLifecycleHooks<TNode> {
  /**
   * 节点创建后、资源挂载前触发。
   *
   * 此时节点仍未挂入 NodeManager，适合记录创建阶段信息。
   *
   * @param node - 新创建的运行时节点。
   */
  readonly created?: (node: TNode) => void
  /**
   * 节点完成资源挂载后触发。
   *
   * @param node - 已完成资源挂载的运行时节点。
   */
  readonly mounted?: (node: TNode) => void
  /**
   * 节点完成配置和资源更新后触发。
   *
   * @param node - 更新后的运行时节点。
   * @param previousNode - 更新前的节点配置快照。
   */
  readonly updated?: (node: TNode, previousNode: TNode) => void
  /**
   * 节点完成资源卸载后触发。
   *
   * @param node - 已完成资源卸载的运行时节点。
   */
  readonly unmounted?: (node: TNode) => void
}

/**
 * RuntimeNode 生命周期事件的内部发布器。
 *
 * @typeParam TNode - 运行时节点类型。
 */
export interface RuntimeNodeLifecycleEmitter<TNode> {
  /**
   * 发布节点创建事件。
   *
   * @param node - 新创建的运行时节点。
   */
  emitCreated(node: TNode): void
  /**
   * 发布节点挂载完成事件。
   *
   * @param node - 已完成资源挂载的运行时节点。
   */
  emitMounted(node: TNode): void
  /**
   * 发布节点更新完成事件。
   *
   * @param node - 更新后的运行时节点。
   * @param previousNode - 更新前的节点配置快照。
   */
  emitUpdated(node: TNode, previousNode: TNode): void
  /**
   * 发布节点卸载完成事件。
   *
   * @param node - 已完成资源卸载的运行时节点。
   */
  emitUnmounted(node: TNode): void
}

/**
 * 创建 RuntimeNode 生命周期事件发布器。
 *
 * Hook 的异常会被隔离，不能中断 Runtime 资源操作。
 *
 * @typeParam TNode - 运行时节点类型。
 * @param hooks - Runtime 创建时固定的生命周期 Hook。
 * @returns 供 Runtime 内部发布事件的 emitter。
 *
 * @example
 * ```ts
 * const lifecycle = createRuntimeNodeLifecycleEmitter({
 *   mounted: (node) => console.log(node),
 * })
 *
 * lifecycle.emitMounted(node)
 * ```
 */
export function createRuntimeNodeLifecycleEmitter<TNode>(
  hooks: RuntimeNodeLifecycleHooks<TNode> = {}
): RuntimeNodeLifecycleEmitter<TNode> {
  /**
   * 调用生命周期 Hook，并隔离 Hook 抛出的异常。
   *
   * @typeParam TArgs - Hook 接收的参数列表类型。
   * @param hook - 待调用的 Hook；未提供时跳过。
   * @param args - 传给 Hook 的参数。
   */
  const notify = <TArgs extends unknown[]>(
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

  // 转发节点创建事件；当前 Runtime 通常不会主动调用此事件。
  const emitCreated = (node: TNode): void => {
    notify(hooks.created, node)
  }

  // 在资源挂载完成后转发事件。
  const emitMounted = (node: TNode): void => {
    notify(hooks.mounted, node)
  }

  // 在配置与资源更新完成后转发新旧节点。
  const emitUpdated = (node: TNode, previousNode: TNode): void => {
    notify(hooks.updated, node, previousNode)
  }

  // 在资源卸载完成后转发事件。
  const emitUnmounted = (node: TNode): void => {
    notify(hooks.unmounted, node)
  }

  return {
    emitCreated,
    emitMounted,
    emitUpdated,
    emitUnmounted,
  }
}
