/**
 * Dependency Runtime 生命周期管理。
 *
 * 管理 DependencyRuntimeNode 的 Presentation、View 与 renderer effect。
 *
 * @module core/runtime/dependency/lifecycle
 */

import { areNamePathListsEqual } from "../../utils/path"
import {
  mountPresentationRuntime,
  unmountPresentationRuntime,
  updatePresentationRuntime,
} from "../presentation"
import { createRuntimeViewState } from "../view/createViewState"

import { createDependencyRendererEffect } from "./rendererEffect"

import type { NamePath, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode, PresentationDynamicProps } from "../node"

/**
 * 挂载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param descriptor - dependency descriptor
 * @param context - 运行时上下文
 */
export function mountDependencyRuntime<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  mountPresentationRuntime(node, context)
  createRuntimeViewState(node, context.debug)
  createDependencyRendererEffect({
    context,
    node,
    scope: node.dispose.child(),
  })
}

/**
 * 更新 dependency 节点的运行时能力。
 *
 * triggerFields 或 renderer identity 变化时才重建 renderer effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param previousDescriptor - 上一轮 descriptor（用于比较 trigger 字段）
 * @param nextDescriptor - 最新 descriptor
 * @param context - 运行时上下文
 */
export function updateDependencyRuntime<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  previousTriggerFields: readonly NamePath<TValues>[] | undefined,
  previousRendererIdentity:
    DependencyRuntimeNode<TValues>["rendererIdentity"] | undefined,
  previousDynamicProps: PresentationDynamicProps<TValues> | null | undefined,
  context: SchemaRuntimeContext<TValues>
): void {
  updatePresentationRuntime(node, previousDynamicProps, context)

  if (
    previousTriggerFields &&
    areNamePathListsEqual(previousTriggerFields, node.triggerFields) &&
    previousRendererIdentity === node.rendererIdentity &&
    node.rendererEffect
  ) {
    return
  }

  node.rendererEffect?.dispose()
  node.rendererEffect = null
  createDependencyRendererEffect({
    context,
    node,
    scope: node.dispose.child(),
  })
}

/**
 * 卸载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 */
export function unmountDependencyRuntime<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>
): void {
  node.rendererEffect?.dispose()
  node.rendererEffect = null
  unmountPresentationRuntime(node)
}
