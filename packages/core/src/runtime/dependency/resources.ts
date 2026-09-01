/**
 * Dependency Runtime 资源管理。
 *
 * 管理 DependencyRuntimeNode 的 Presentation 与 renderer effect。
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

import type {
  NamePath,
  SchemxContainerDependencies,
  SchemxDependencyField,
  Values,
} from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode } from "../node"

/**
 * 挂载 dependency 节点的运行时能力。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param descriptor - dependency descriptor
 * @param context - 运行时上下文
 */
export function mountDependencyResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
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
 * @param previousDescriptor - 上一轮 descriptor（用于比较 trigger 字段）
 * @param nextDescriptor - 最新 descriptor
 * @param context - 运行时上下文
 */
export function updateDependencyResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  previousTriggerFields: readonly NamePath<TValues>[] | undefined,
  previousRendererIdentity: SchemxDependencyField<TValues>["renderer"] | undefined,
  previousDynamicConfig: SchemxContainerDependencies<TValues> | undefined,
  context: SchemaRuntimeContext<TValues>
): void {
  updatePresentationResources(node, previousDynamicConfig, context)

  if (
    previousTriggerFields &&
    areNamePathListsEqual(previousTriggerFields, node.staticSchema.value.to) &&
    previousRendererIdentity === node.staticSchema.value.renderer &&
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
  node: DependencyRuntimeNode<TValues>
): void {
  node.rendererEffect?.dispose()
  node.rendererEffect = null
  unmountPresentationResources(node)
}
