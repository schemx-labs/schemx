/**
 * Dependency Runtime 资源管理。
 *
 * 管理 DependencyNode 的 Presentation 与 renderer effect。
 *
 * @module core/runtime/dependency/resources
 */

import { areNamePathListsEqual } from "../../utils/path"
import {
  mountPresentationResources,
  unmountPresentationResources,
  updatePresentationResources,
} from "../presentation"

import { createDependencyRendererEffect } from "./rendererEffect"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyNode } from "../node"

/**
 * 挂载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 */
export function mountDependencyResources<TValues extends Values>(
  node: DependencyNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  mountPresentationResources(node, context)
  createDependencyRendererEffect({
    context,
    node,
    scope: node.scope.child(),
  })
}

/**
 * 更新 dependency 节点的运行时能力。
 *
 * `to` 或 renderer 变化时才重建 renderer effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param previousNode - 更新前的 dependency 运行时节点快照
 */
export function updateDependencyResources<TValues extends Values>(
  node: DependencyNode<TValues>,
  previousNode: DependencyNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  updatePresentationResources(node, previousNode, context)

  const previousSchema = previousNode.staticSchema.peek()

  const currentSchema = node.staticSchema.peek()

  const rendererContextChanged =
    previousNode.rendererContextKey !== node.rendererContextKey

  if (
    areNamePathListsEqual(previousSchema.to, currentSchema.to) &&
    previousSchema.renderer === currentSchema.renderer &&
    !rendererContextChanged &&
    node.rendererEffect
  ) {
    return
  }

  node.rendererEffect?.dispose()
  node.rendererEffect = null
  createDependencyRendererEffect({
    context,
    node,
    scope: node.scope.child(),
  })
}

/**
 * 卸载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 */
export function unmountDependencyResources<TValues extends Values>(
  node: DependencyNode<TValues>
): void {
  node.rendererEffect?.dispose()
  node.rendererEffect = null
  unmountPresentationResources(node)
}
