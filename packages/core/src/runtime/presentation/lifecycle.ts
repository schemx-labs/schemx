/**
 * 呈现状态生命周期管理。
 *
 * @module core/runtime/presentation/lifecycle
 */

import { areNamePathListsEqual } from "../../utils/path"

import { createPresentationDependenciesEffect } from "./dependenciesEffect"
import { createInheritedPresentationState, createPresentationRuntimeState } from "./state"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode, GroupRuntimeNode } from "../node"

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
export function mountPresentationRuntime<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 创建当前节点的容器状态，并连接祖先状态投影。
  const runtimeState = createPresentationRuntimeState({
    nodeId: node.id,
    staticState: node.staticState,
    inheritedState: createInheritedPresentationState(node),
  })

  node.presentationState = runtimeState
  recreatePresentationEffect(node, runtimeState, context)
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
export function updatePresentationRuntime<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  previousDynamicProps: StatefulPresentationNode<TValues>["dynamicProps"] | undefined,
  context: SchemaRuntimeContext<TValues>
): void {
  // 当前节点已挂载的容器状态；缺失时说明节点生命周期尚未完整建立。
  const runtimeState = node.presentationState

  if (!runtimeState) {
    mountPresentationRuntime(node, context)

    return
  }

  // 更新容器静态状态
  runtimeState.staticState.value = node.staticState

  if (hasSameDynamicProps(previousDynamicProps, node.dynamicProps)) {
    return
  }

  if (!node.dynamicProps) {
    node.presentationEffectScope?.dispose()
    node.presentationEffectScope = null
    // 清空容器动态覆盖，使其回退到静态状态。
    runtimeState.dynamicOverrides.value = {}

    return
  }

  recreatePresentationEffect(node, runtimeState, context)
}

/**
 * 释放容器状态 effect 并清理节点引用。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - Group 或 Dependency 运行时节点。
 */
export function unmountPresentationRuntime<TValues extends Values>(
  node: StatefulPresentationNode<TValues>
): void {
  node.presentationEffectScope?.dispose()
  node.presentationEffectScope = null
  node.presentationState = null
}

/**
 * 重建节点的容器动态 effect，并将其生命周期绑定到节点作用域。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - 要重建资源的容器节点。
 * @param descriptor - 最新容器 descriptor。
 * @param runtimeState - 接收动态覆盖的容器状态。
 * @param context - 表单运行时上下文。
 */
function recreatePresentationEffect<TValues extends Values>(
  node: StatefulPresentationNode<TValues>,
  runtimeState: NonNullable<StatefulPresentationNode<TValues>["presentationState"]>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 先释放旧 effect，避免同一节点存在多个依赖订阅。
  node.presentationEffectScope?.dispose()

  if (!node.dynamicProps) {
    node.presentationEffectScope = null

    return
  }

  // 为本次动态 effect 创建独立的子作用域。
  const effectDispose = node.dispose.child()

  node.presentationEffectScope = effectDispose

  createPresentationDependenciesEffect({
    context,
    taskId: `presentation:${node.id}:dependencies`,
    dynamicProps: node.dynamicProps,
    runtimeState,
    schemaLabel: `${node.type === "group" ? "Group" : "Dependency"} Schema "${node.key}"`,
    scope: effectDispose,
  })

  // 只清理仍属于当前节点的作用域引用，避免旧作用域覆盖新引用。
  effectDispose.add(() => {
    if (node.presentationEffectScope === effectDispose) {
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
function hasSameDynamicProps<TValues extends Values>(
  previous: StatefulPresentationNode<TValues>["dynamicProps"] | undefined,
  next: StatefulPresentationNode<TValues>["dynamicProps"]
): boolean {
  // 取出两版 descriptor 中的动态依赖描述。
  if (!previous || !next) {
    return previous === next
  }

  return (
    previous.dependencies === next.dependencies &&
    areNamePathListsEqual(previous.triggerFields, next.triggerFields)
  )
}
