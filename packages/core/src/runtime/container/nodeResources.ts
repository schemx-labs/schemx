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
  resetContainerDynamicOverrides,
  setContainerStaticState,
} from "./runtimeState"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyDescriptor, GroupDescriptor } from "../descriptor"
import type { DependencyRuntimeNode, GroupRuntimeNode } from "../node"

type StatefulContainerNode<TValues extends Values> =
  GroupRuntimeNode<TValues> | DependencyRuntimeNode<TValues>

type StatefulContainerDescriptor<TValues extends Values> =
  GroupDescriptor<TValues> | DependencyDescriptor<TValues>

/**
 * 挂载容器状态和动态属性 effect。
 *
 * @param node - Group 或 Dependency 运行时节点。
 * @param descriptor - 对应的容器 descriptor。
 * @param context - 表单运行时上下文。
 */
export function mountContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  descriptor: StatefulContainerDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
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
 */
export function updateContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  previousDescriptor: StatefulContainerDescriptor<TValues> | undefined,
  nextDescriptor: StatefulContainerDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const runtimeState = node.containerState

  if (!runtimeState) {
    mountContainerNodeResources(node, nextDescriptor, context)

    return
  }

  setContainerStaticState(runtimeState, nextDescriptor.staticState)

  if (hasSameDynamicProps(previousDescriptor, nextDescriptor)) {
    return
  }

  if (!nextDescriptor.dynamicProps) {
    node.containerEffectDispose?.dispose()
    node.containerEffectDispose = null
    resetContainerDynamicOverrides(runtimeState)

    return
  }

  recreateContainerEffect(node, nextDescriptor, runtimeState, context)
}

/**
 * 释放容器状态 effect 并清理节点引用。
 *
 * @param node - Group 或 Dependency 运行时节点。
 */
export function unmountContainerNodeResources<TValues extends Values>(
  node: StatefulContainerNode<TValues>
): void {
  node.containerEffectDispose?.dispose()
  node.containerEffectDispose = null
  node.containerState = null
}

function recreateContainerEffect<TValues extends Values>(
  node: StatefulContainerNode<TValues>,
  descriptor: StatefulContainerDescriptor<TValues>,
  runtimeState: NonNullable<StatefulContainerNode<TValues>["containerState"]>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.containerEffectDispose?.dispose()

  if (!descriptor.dynamicProps) {
    node.containerEffectDispose = null

    return
  }

  const effectDispose = node.dispose.child()

  node.containerEffectDispose = effectDispose

  createContainerDependenciesEffect({
    context,
    dynamicProps: descriptor.dynamicProps,
    runtimeState,
    scope: effectDispose,
  })

  effectDispose.add(() => {
    if (node.containerEffectDispose === effectDispose) {
      node.containerEffectDispose = null
    }
  })
}

function hasSameDynamicProps<TValues extends Values>(
  previousDescriptor: StatefulContainerDescriptor<TValues> | undefined,
  nextDescriptor: StatefulContainerDescriptor<TValues>
): boolean {
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
