/**
 * Dependency Runtime 资源管理。
 *
 * 管理 DependencyNode 的 Presentation 与 renderer effect。
 *
 * @module core/runtime/dependency/resources
 */

import { areNamePathListsEqual } from "../../utils"
import {
  mountPresentationResources,
  unmountPresentationResources,
  updatePresentationResources,
} from "../presentation"

import { createDependencyRendererEffect } from "./index"

import type { ChildReconciler, SchemaRuntimeContext } from ".."
import type { Values } from "../../types"
import type { DependencyNode } from "../node"

/**
 * 挂载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 * @param childReconciler - renderer 输出提交时使用的子树协调能力。
 * @example mountDependencyResources(node, context, childReconciler)
 */
export function mountDependencyResources<TValues extends Values>(
  node: DependencyNode<TValues>,
  context: SchemaRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  mountPresentationResources(node, context)
  createDependencyRendererEffect({
    context,
    childReconciler,
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
 * @param context - 运行时上下文。
 * @param childReconciler - 行路径关联和 renderer 输出提交使用的子树协调能力。
 * @example updateDependencyResources(node, previousNode, context, childReconciler)
 */
export function updateDependencyResources<TValues extends Values>(
  node: DependencyNode<TValues>,
  previousNode: DependencyNode<TValues>,
  context: SchemaRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  updatePresentationResources(node, previousNode, context)

  const previousSchema = previousNode.compiledSchema.peek()

  const currentSchema = node.compiledSchema.peek()

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

  // 行上下文已改变，已有输出先同步关联新路径，再等待异步 renderer 刷新。
  if (
    rendererContextChanged &&
    previousNode.rendererContextKey &&
    node.rendererContextKey
  ) {
    const previous = previousNode.rendererContextKey

    const current = node.rendererContextKey

    childReconciler.rebaseChildren(
      node.id,
      previous.slice(previous.indexOf(":") + 1),
      current.slice(current.indexOf(":") + 1)
    )
  }

  createDependencyRendererEffect({
    context,
    childReconciler,
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
