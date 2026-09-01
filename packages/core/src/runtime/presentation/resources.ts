/**
 * 呈现状态资源管理。
 *
 * @module core/runtime/presentation/resources
 */

import { areNamePathListsEqual } from "../../utils/path"

import { createPresentationDependenciesEffect } from "./dependenciesEffect"

import type { SchemxContainerDependencies, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type {
  DependencyRuntimeNode,
  GroupRuntimeNode,
} from "../node"

/**
 * 需要维护容器状态的运行时节点类型。
 */
type StatefulPresentationNode<TValues extends Values> =
  GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 需要维护容器状态的 descriptor 类型。
 */
/**
 * 挂载容器状态和动态属性 effect。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - Group 或 Dependency 运行时节点。
 * @param descriptor - 对应的容器 descriptor。
 * @param context - 表单运行时上下文。
 */
export function mountPresentationResources<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  recreatePresentationEffect(node, context)
}

/**
 * 更新容器静态状态，并仅在 dependencies 配置变化时重建状态 effect。
 *
 * @param node - Group 或 Dependency 运行时节点。
 * @param previousDescriptor - 上一轮容器 descriptor。
 * @param nextDescriptor - 最新容器 descriptor。
 * @param context - 表单运行时上下文。
 *
 * @remarks
 * 只有 dependencies 引用或 triggerFields 变化时才重建 effect；静态状态更新会复用
 * 现有的动态 effect 和异步任务。
 */
export function updatePresentationResources<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  previousDynamicConfig: SchemxContainerDependencies<TValues> | undefined,
  context: SchemaRuntimeContext<TValues>
): void {
  const dynamicConfig = node.staticSchema.value.dependencies

  if (hasSameDynamicConfig(previousDynamicConfig, dynamicConfig)) {
    return
  }

  if (!dynamicConfig) {
    node.presentationEffectScope?.dispose()
    node.presentationEffectScope = null
    // 清空容器动态覆盖，使其回退到静态状态。
    node.dynamicOverrides.value = {}

    return
  }

  recreatePresentationEffect(node, context)
}

/**
 * 释放容器状态 effect 并清理节点引用。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - Group 或 Dependency 运行时节点。
 */
export function unmountPresentationResources<TValues extends Values>(
  node: StatefulPresentationNode<TValues>
): void {
  node.presentationEffectScope?.dispose()
  node.presentationEffectScope = null
  // 运行态 Signal 在节点创建时初始化，卸载只释放呈现资源。
}

/**
 * 重建节点的容器动态 effect，并将其生命周期绑定到节点作用域。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - 接收动态覆盖的容器 RuntimeNode。
 * @param context - 表单运行时上下文。
 */
function recreatePresentationEffect<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 先释放旧 effect，避免同一节点存在多个依赖订阅。
  node.presentationEffectScope?.dispose()

  if (!node.staticSchema.value.dependencies) {
    node.presentationEffectScope = null

    return
  }

  // 为本次动态 effect 创建独立的子作用域。
  const presentationEffectScope = node.scope.child()

  node.presentationEffectScope = presentationEffectScope

  createPresentationDependenciesEffect({
    context,
    taskId: `presentation:${node.id}:dependencies`,
    node,
    schemaLabel: `${node.type === "group" ? "Group" : "Dependency"} Schema "${node.key}"`,
    scope: presentationEffectScope,
  })

  // 只清理仍属于当前节点的作用域引用，避免旧作用域覆盖新引用。
  presentationEffectScope.add(() => {
    if (node.presentationEffectScope === presentationEffectScope) {
      node.presentationEffectScope = null
    }
  })
}

/**
 * 判断两版容器 descriptor 是否可以复用现有动态 effect。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param previousDescriptor - 上一轮容器 descriptor。
 * @param nextDescriptor - 最新容器 descriptor。
 * @returns dependencies 与触发字段均未变化时返回 `true`。
 */
function hasSameDynamicConfig<TValues extends Values>(
  previous: SchemxContainerDependencies<TValues> | undefined,
  next: SchemxContainerDependencies<TValues> | undefined
): boolean {
  if (!previous || !next) {
    return previous === next
  }

  if (previous !== next) {
    return false
  }

  return areNamePathListsEqual(previous.triggerFields, next.triggerFields)
}
