/**
 * DependencyNodeResources - dependency 运行时节点的资源挂载与更新。
 *
 * 管理 DependencyRuntimeNode 的生命周期：创建视图状态、注册依赖索引、
 * 创建 dependency effect 并在字段变更时重建。
 *
 * @module core/runtime/field/dependencyNodeResources
 */

import { areNamePathListsEqual } from "../../utils/path"
import {
  mountContainerNodeResources,
  unmountContainerNodeResources,
  updateContainerNodeResources,
} from "../container"
import { createRuntimeViewState } from "../view/createViewState"

import { createDependencyEffect } from "./dependencyEffect"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyDescriptor } from "../descriptor"
import type { DependencyRuntimeNode } from "../node"

/**
 * 挂载 dependency 运行时节点的资源。
 *
 * 依次创建视图状态、注册依赖索引、创建 dependency effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param descriptor - dependency descriptor
 * @param context - 运行时上下文
 */
export function mountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  descriptor: DependencyDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const resources = context.nodeResources

  mountContainerNodeResources(node, descriptor, context)
  createRuntimeViewState(node, descriptor, resources)
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor,
    scope: node.dispose.child(),
  })
}

/**
 * 更新 dependency 运行时节点的资源。
 *
 * 当 trigger 字段列表变化时，先注销旧依赖索引，销毁旧 effect，
 * 再重新注册并创建新 effect；否则只更新视图状态。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param previousDescriptor - 上一轮 descriptor（用于比较 trigger 字段）
 * @param nextDescriptor - 最新 descriptor
 * @param context - 运行时上下文
 */
export function updateDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  previousDescriptor: DependencyDescriptor<TValues> | undefined,
  nextDescriptor: DependencyDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const resources = context.nodeResources

  updateContainerNodeResources(node, previousDescriptor, nextDescriptor, context)
  createRuntimeViewState(node, nextDescriptor, resources)

  if (
    previousDescriptor &&
    areNamePathListsEqual(
      previousDescriptor.triggerFields,
      nextDescriptor.triggerFields
    ) &&
    previousDescriptor.rendererIdentity === nextDescriptor.rendererIdentity &&
    node.effectState
  ) {
    return
  }

  resources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor: nextDescriptor,
    scope: node.dispose.child(),
  })
}

/**
 * 卸载 dependency 运行时节点的资源。
 *
 * 从依赖索引中注销，销毁 effect 并清理节点引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 */
export function unmountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  context.nodeResources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
  unmountContainerNodeResources(node)
}
