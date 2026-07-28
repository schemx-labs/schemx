/**
 * 容器节点运行时资源管理。
 *
 * @module core/runtime/container/nodeResources
 */

import { areNamePathListsEqual } from "../../utils/path"

import { createContainerDependenciesEffect } from "./dependenciesEffect"
import {
  createContainerRuntimeState,
  createInheritedContainerState,
} from "./runtimeState"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyDescriptor, GroupDescriptor } from "../descriptor"
import type { DependencyRuntimeNode, GroupRuntimeNode } from "../node"

/**
 * 需要维护容器状态的运行时节点类型。
 */
type StatefulContainerNode<TValues extends Values> =
  GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

/**
 * 需要维护容器状态的 descriptor 类型。
 */
type StatefulContainerDescriptor<TValues extends Values> =
  GroupDescriptor<TValues> | DependencyDescriptor<TValues>

/**
 * 挂载容器状态和动态属性 effect。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - Group 或 Dependency 运行时节点。
 * @param descriptor - 对应的容器 descriptor。
 * @param context - 表单运行时上下文。
 */
export function mountContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  descriptor: StatefulContainerDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 创建当前节点的容器状态，并连接祖先状态投影。
  const runtimeState = createContainerRuntimeState({
    nodeId: node.id,
    staticState: descriptor.staticState,
    inheritedState: createInheritedContainerState(node),
  })

  node.containerState = runtimeState
  recreateContainerEffect(node, descriptor, runtimeState, context)
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
export function updateContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  previousDescriptor: StatefulContainerDescriptor<TValues> | undefined,
  nextDescriptor: StatefulContainerDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 当前节点已挂载的容器状态；缺失时说明节点生命周期尚未完整建立。
  const runtimeState = node.containerState

  if (!runtimeState) {
    mountContainerNodeResources(node, nextDescriptor, context)

    return
  }

  // 更新容器静态状态
  runtimeState.staticState.value = nextDescriptor.staticState

  if (hasSameDynamicProps(previousDescriptor, nextDescriptor)) {
    return
  }

  if (!nextDescriptor.dynamicProps) {
    node.containerEffectDispose?.dispose()
    node.containerEffectDispose = null
    // 清空容器动态覆盖，使其回退到静态状态。
    runtimeState.dynamicOverrides.value = {}

    return
  }

  recreateContainerEffect(node, nextDescriptor, runtimeState, context)
}

/**
 * 释放容器状态 effect 并清理节点引用。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param node - Group 或 Dependency 运行时节点。
 */
export function unmountContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>
): void {
  node.containerEffectDispose?.dispose()
  node.containerEffectDispose = null
  node.containerState = null
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
function recreateContainerEffect<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  descriptor: StatefulContainerDescriptor<TValues>,
  runtimeState: NonNullable<StatefulContainerNode<TValues>["containerState"]>,
  context: SchemaRuntimeContext<TValues>
): void {
  // 先释放旧 effect，避免同一节点存在多个依赖订阅。
  node.containerEffectDispose?.dispose()

  if (!descriptor.dynamicProps) {
    node.containerEffectDispose = null

    return
  }

  // 为本次动态 effect 创建独立的子作用域。
  const effectDispose = node.dispose.child()

  node.containerEffectDispose = effectDispose

  createContainerDependenciesEffect({
    context,
    taskId: `container:${node.id}:dependencies`,
    dynamicProps: descriptor.dynamicProps,
    runtimeState,
    scope: effectDispose,
  })

  // 只清理仍属于当前节点的作用域引用，避免旧作用域覆盖新引用。
  effectDispose.add(() => {
    if (node.containerEffectDispose === effectDispose) {
      node.containerEffectDispose = null
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
  previousDescriptor: StatefulContainerDescriptor<TValues> | undefined,
  nextDescriptor: StatefulContainerDescriptor<TValues>
): boolean {
  // 取出两版 descriptor 中的动态依赖描述。
  const previous = previousDescriptor?.dynamicProps

  const next = nextDescriptor.dynamicProps

  if (!previous || !next) {
    return previous === next
  }

  return (
    previous.dependencies === next.dependencies &&
    areNamePathListsEqual(previous.triggerFields, next.triggerFields)
  )
}
