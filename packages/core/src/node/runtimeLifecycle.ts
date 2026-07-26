/**
 * RuntimeNode 生命周期管理。
 *
 * 负责 RuntimeNode 的挂载、更新、卸载操作，协调领域资源
 * （字段状态、视图状态、dependency effect）的创建与销毁，
 * 并通过 lifecycleBus 发出生命周期事件供外部监听。
 *
 * @module core/node/runtimeLifecycle
 */

import {
  mountContainerNodeResources,
  unmountContainerNodeResources,
  updateContainerNodeResources,
} from "../container"
import {
  mountDependencyNodeResources,
  mountFieldNodeResources,
  unmountDependencyNodeResources,
  unmountFieldNodeResources,
  updateDependencyNodeResources,
  updateFieldNodeResources,
} from "../field"
import {
  createRuntimeViewState,
  deleteRuntimeViewState,
  updateRuntimeViewState,
} from "../view/createViewState"

import type { FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { Values } from "../types"
import type { DescribedRuntimeNode, RuntimeNode } from "./types"

/**
 * RuntimeNode 生命周期操作的接口。
 *
 * 提供 mount（挂载）、update（更新）、unmount（卸载）三个核心操作，
 * 以及递归卸载子树的 unmountSubtree。
 *
 * @typeParam TValues - 表单值类型
 */
export interface RuntimeLifecycle<TValues extends Values = Values> {
  /**
   * 挂载节点。
   *
   * 设置 descriptor、创建领域资源、标记已挂载。
   *
   * @param node - 待挂载的节点
   * @param descriptor - 节点对应的 form descriptor
   */
  mount(node: DescribedRuntimeNode<TValues>, descriptor: FormDescriptor<TValues>): void

  /**
   * 更新节点。
   *
   * 当 schema 变化导致 descriptor 变更时调用，更新 descriptor 和领域资源。
   *
   * @param node - 待更新的节点
   * @param previousDescriptor - 旧的 descriptor，首次更新时为 null
   * @param nextDescriptor - 新的 descriptor
   */
  update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void

  /**
   * 卸载单个节点。
   *
   * root 节点不能被卸载。
   *
   * @param node - 待卸载的节点
   */
  unmount(node: RuntimeNode<TValues>): void

  /**
   * 递归卸载整棵子树。
   *
   * 从叶子到根反向遍历，确保子节点先于父节点被卸载。
   *
   * @param node - 子树根节点
   */
  unmountSubtree(node: RuntimeNode<TValues>): void
}

/**
 * 创建 RuntimeNode 生命周期管理器。
 *
 * @typeParam TValues - 表单值类型
 * @param context - 表单运行时上下文，提供 nodeResources、lifecycleBus 等实例级服务
 * @returns RuntimeLifecycle 实例
 */
export function createRuntimeLifecycle<TValues extends Values = Values>(
  context: SchemxContext<TValues>
): RuntimeLifecycle<TValues> {
  const resources = context.nodeResources

  const bus = context.lifecycleBus

  return {
    mount,
    update,
    unmount,
    unmountSubtree,
  }

  /**
   * 挂载节点：设置 descriptor、创建领域资源、标记已挂载。
   *
   * 挂载顺序：
   * 1. 发出 beforeMount 事件
   * 2. 创建该节点类型的领域资源（字段状态、视图状态、dependency effect）
   * 3. 标记 mounted 为 true
   * 4. 发出 mount 事件
   */
  function mount(
    node: DescribedRuntimeNode<TValues>,
    descriptor: FormDescriptor<TValues>
  ): void {
    if (!node.parent) {
      throw new Error(
        `[schemx] Runtime node "${node.key}" must have a parent before mount.`
      )
    }

    node.descriptor = descriptor
    bus.emitBeforeMount(node)

    mountRuntimeResources(node, descriptor)
    node.mounted.value = true

    bus.emitMount(node)
  }

  /**
   * 更新节点：校验类型一致性、更新 descriptor 和领域资源。
   *
   * 更新时先校验 node.type 与 nextDescriptor.type 一致，
   * 然后依次触发 beforeUpdate、更新资源、update、updated 事件。
   *
   * @throws 如果节点类型与新 descriptor 类型不匹配则抛出错误
   */
  function update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type !== nextDescriptor.type) {
      throw new Error(
        `unexpected descriptor type: node ${node.type} cannot update with ${nextDescriptor.type}`
      )
    }

    const previousNode = { ...node }

    bus.emitBeforeUpdate(node, previousNode)
    node.descriptor = nextDescriptor
    updateRuntimeResources(node, previousDescriptor, nextDescriptor)
    bus.emitUpdate(node, previousNode)
    bus.emitUpdated(node, previousNode)
  }

  /**
   * 递归卸载整棵子树。
   *
   * 采用后序遍历（先子后父），确保子节点的资源在父节点之前被释放。
   * field 节点没有子节点，直接卸载自身。
   */
  function unmountSubtree(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      return
    }

    for (const child of node.type === "field" ? [] : node.childNodes.value) {
      unmountSubtree(child)
    }

    unmount(node)
  }

  /**
   * 卸载单个节点。
   *
   * root 节点不能被卸载（直接返回）。
   * 卸载顺序：发出 beforeUnmount 事件、释放领域资源、发出 unmount 事件。
   */
  function unmount(node: RuntimeNode<TValues>): void {
    if (node.type === "root") {
      return
    }

    bus.emitBeforeUnmount(node)
    unmountRuntimeResources(node)
    bus.emitUnmount(node)
  }

  /**
   * 根据节点类型挂载对应的领域资源。
   *
   * - field 节点：挂载字段运行时状态（验证器、校验 effect 等）
   * - group 节点：创建运行时视图状态
   * - dependency 节点：挂载 dependency effect（动态子节点渲染）
   */
  function mountRuntimeResources(
    node: DescribedRuntimeNode<TValues>,
    descriptor: FormDescriptor<TValues>
  ): void {
    if (node.type === "field" && descriptor.type === "field") {
      mountFieldNodeResources(node, descriptor, context)

      return
    }

    if (node.type === "group" && descriptor.type === "group") {
      mountGroupResources(node, descriptor)

      return
    }

    if (node.type === "dependency" && descriptor.type === "dependency") {
      mountDependencyNodeResources(node, descriptor, context)
    }
  }

  /**
   * 根据节点类型更新对应的领域资源。
   *
   * - field 节点：更新字段运行时状态
   * - group 节点：重新挂载 group 资源（视图状态重建）
   * - dependency 节点：更新 dependency effect
   */
  function updateRuntimeResources(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type === "field" && nextDescriptor.type === "field") {
      updateFieldNodeResources(
        node,
        previousDescriptor?.type === "field" ? previousDescriptor : undefined,
        nextDescriptor,
        context
      )

      return
    }

    if (node.type === "group" && nextDescriptor.type === "group") {
      mountGroupResources(
        node,
        nextDescriptor,
        previousDescriptor?.type === "group" ? previousDescriptor : undefined
      )

      return
    }

    if (node.type === "dependency" && nextDescriptor.type === "dependency") {
      updateDependencyNodeResources(
        node,
        previousDescriptor?.type === "dependency" ? previousDescriptor : undefined,
        nextDescriptor,
        context
      )
    }
  }

  /**
   * 挂载 group 节点的资源。
   *
   * Group 节点依次挂载容器状态、动态属性 effect 和运行时视图状态。
   */
  function mountGroupResources(
    node: Extract<RuntimeNode<TValues>, { type: "group" }>,
    descriptor: Extract<FormDescriptor<TValues>, { type: "group" }>,
    previousDescriptor?: Extract<FormDescriptor<TValues>, { type: "group" }>
  ): void {
    if (node.containerState) {
      updateContainerNodeResources(node, previousDescriptor, descriptor, context)
      updateRuntimeViewState(node, descriptor, resources)

      return
    }

    mountContainerNodeResources(node, descriptor, context)
    createRuntimeViewState(node, descriptor, resources)
  }

  /**
   * 根据节点类型卸载对应的领域资源。
   *
   * 所有节点类型都会先删除运行时视图状态，
   * field 和 dependency 节点还需额外卸载其特定领域资源。
   */
  function unmountRuntimeResources(node: RuntimeNode<TValues>): void {
    const descriptor = node.type === "root" ? undefined : (node.descriptor ?? undefined)

    deleteRuntimeViewState(node, resources)

    if (node.type === "field" && descriptor?.type === "field") {
      unmountFieldNodeResources(node, context)
    } else if (node.type === "group") {
      unmountContainerNodeResources(node)
    } else if (node.type === "dependency") {
      unmountDependencyNodeResources(node, context)
    }
  }
}
