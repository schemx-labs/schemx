/**
 * Node 资源编排。
 *
 * 统一协调领域资源、ViewSchema computed 和对外生命周期事件。
 *
 * @module core/runtime/node/resources
 */

import { createComputed, createSignal } from "../../reactivity"
import {
  mountDependencyResources,
  unmountDependencyResources,
  updateDependencyResources,
} from "../dependency"
import {
  mountDynamicResources,
  unmountDynamicResources,
  updateDynamicResources,
} from "../dynamic/resources"
import {
  mountFieldResources,
  unmountFieldResources,
  updateFieldResources,
} from "../field"
import {
  mountPresentationResources,
  unmountPresentationResources,
  updatePresentationResources,
} from "../presentation"
import { attachNodeViewSchemas, detachNodeViewSchemas } from "../view/viewProjection"

import {
  isDependencyNode,
  isDynamicNode,
  isFieldNode,
  isGroupNode,
  isRootNode,
  updateFieldDiagnostics,
} from "./helper"

import type { NamePath, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { ContainerNode, SchemaNode } from "./types"

/**
 * Node 的资源与生命周期编排门面。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface NodeLifecycle<TValues extends Values = Values> {
  /**
   * 记录节点已创建，并转发创建事件。
   *
   * @param node - 新创建的 SchemaNode。
   */
  created(node: SchemaNode<TValues>): void
  /**
   * 挂载节点的领域资源和 ViewSchema computed。
   *
   * @param node - 已挂入节点树的 SchemaNode。
   */
  mount(node: SchemaNode<TValues>): void
  /**
   * 使用 detached 节点更新当前节点及其领域资源。
   *
   * @param current - 树中被复用的当前节点。
   * @param desired - 携带下一轮配置的 detached 节点。
   */
  update(
    current: SchemaNode<TValues>,
    desired: SchemaNode<TValues>
  ): NamePath<TValues> | undefined
  /**
   * 卸载节点并按需删除字段当前值。
   *
   * @param node - 要卸载的 Node。
   * @param options - 当前卸载是否需要删除字段值。
   */
  unmount(node: ContainerNode<TValues>, options?: NodeUnmountOptions): void
  /**
   * 释放节点的资源作用域。
   *
   * @param node - 要释放的 Node。
   */
  dispose(node: ContainerNode<TValues>): void
  /**
   * 丢弃尚未挂载的节点及其资源作用域。
   *
   * @param node - 要丢弃的 SchemaNode。
   */
  discard(node: SchemaNode<TValues>): void
  /**
   * 删除一个已确认不再被活动字段使用的旧字段路径。
   *
   * Reconciler 会在整批节点协调完成后调用该方法，避免 Dynamic 行重排时误删值。
   */
  removeFieldValue(name: NamePath<TValues>): void
}

/**
 * Node 卸载时的值清理选项。
 */
export interface NodeUnmountOptions {
  /**
   * 是否删除字段当前值。
   *
   * 仅对 FieldNode 生效；省略或为 `false` 时保留当前值。
   */
  readonly isRemoveFieldValue?: boolean
}

/**
 * 创建 Node 生命周期门面。
 *
 * @typeParam TValues - 表单值类型。
 * @param context - 表单运行时上下文。
 * @returns 供 reconciler 调用的资源与生命周期操作集合。
 *
 * @example
 * ```ts
 * const lifecycle = createNodeLifecycle(context)
 * lifecycle.mount(node)
 * ```
 */
export function createNodeLifecycle<TValues extends Values>(
  context: SchemaRuntimeContext<TValues>
): NodeLifecycle<TValues> {
  // 创建事件只负责通知，不创建节点资源。
  const created = (node: SchemaNode<TValues>): void => {
    context.lifecycle.emitCreated(node)
  }

  // 挂载领域资源、ViewSchema computed，并在完成后发布 mounted 事件。
  const mount = (node: SchemaNode<TValues>): void => {
    mountNodeResources(node, context)
  }

  // 更新当前节点的配置和资源，并发布 updated 事件。
  const update = (
    current: SchemaNode<TValues>,
    desired: SchemaNode<TValues>
  ): NamePath<TValues> | undefined => {
    return updateNodeResources(current, desired, context)
  }

  // 卸载 ViewSchema computed 和领域资源，但不释放节点自身 scope。
  const unmount = (node: ContainerNode<TValues>, options?: NodeUnmountOptions): void => {
    unmountNodeResources(node, context, options)
  }

  // 幂等释放节点 scope；discard 复用同一释放语义。
  const dispose = (node: ContainerNode<TValues>): void => {
    if (node.disposed.peek()) {
      return
    }

    node.disposed.value = true
    node.scope.dispose()
  }

  const removeFieldValue = (name: NamePath<TValues>): void => {
    context.store.removeFieldValue(name)
  }

  return {
    created,
    mount,
    update,
    unmount,
    dispose,
    discard: dispose,
    removeFieldValue,
  }
}

/**
 * 挂载 Node 的领域资源和 ViewSchema computed。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 已挂入父节点的 Node。
 * @param context - 表单运行时上下文。
 * @throws 节点尚未挂入父节点时抛出错误。
 *
 * @example
 * ```ts
 * mountNodeResources(node, context)
 * ```
 */
export function mountNodeResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (!node.parent) {
    throw new Error(
      `[schemx] Runtime node "${node.key}" must have a parent before mount.`
    )
  }

  mountDomainResources(node, context)
  attachNodeViewSchemas(node, context.debug)
  context.lifecycle.emitMounted(node)
}

/**
 * 使用目标节点配置更新 Node 的领域资源。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 实际树中被复用的节点。
 * @param desired - 携带下一轮配置的 detached 节点。
 * @param context - 表单运行时上下文。
 *
 * @example
 * ```ts
 * updateNodeResources(currentNode, desiredNode, context)
 * ```
 */
export function updateNodeResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  desired: SchemaNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): NamePath<TValues> | undefined {
  let previousNode: SchemaNode<TValues>

  if (isFieldNode(node)) {
    const resolvedSchemaSnapshot = node.resolvedSchema.peek()

    const validationStateSnapshot = node.validationState.peek()

    const diagnostics = node.diagnostics?.peek()

    const compiledSchema = createSignal(node.compiledSchema.peek())

    const dependencyOverrides = createSignal(node.dependencyOverrides.peek())

    const resolvedSchema = createComputed(() => resolvedSchemaSnapshot)

    const validationState = createComputed(() => validationStateSnapshot)

    previousNode = {
      ...node,
      name: createSignal(node.name.peek()),
      compiledSchema,
      staticSchema: compiledSchema,
      dependencyOverrides,
      dynamicOverrides: dependencyOverrides,
      resolvedSchema,
      effectiveSchema: resolvedSchema,
      validationState,
      validationSchema: validationState,
      diagnostics: diagnostics === undefined ? undefined : createSignal(diagnostics),
    }
  } else if (isGroupNode(node)) {
    const presentationState = node.presentationState.peek()

    const compiledSchema = createSignal(node.compiledSchema.peek())

    const dependencyOverrides = createSignal(node.dependencyOverrides.peek())

    const presentationStateSignal = createComputed(() => presentationState)

    previousNode = {
      ...node,
      compiledSchema,
      staticSchema: compiledSchema,
      dependencyOverrides,
      dynamicOverrides: dependencyOverrides,
      presentationState: presentationStateSignal,
      effectiveState: presentationStateSignal,
    }
  } else if (isDynamicNode(node)) {
    const presentationState = node.presentationState.peek()

    const compiledSchema = createSignal(node.compiledSchema.peek())

    const dependencyOverrides = createSignal(node.dependencyOverrides.peek())

    const presentationStateSignal = createComputed(() => presentationState)

    previousNode = {
      ...node,
      compiledSchema,
      staticSchema: compiledSchema,
      dependencyOverrides,
      dynamicOverrides: dependencyOverrides,
      presentationState: presentationStateSignal,
      effectiveState: presentationStateSignal,
      dynamicRows: createSignal(node.dynamicRows.peek()),
    }
  } else {
    const presentationState = node.presentationState.peek()

    const compiledSchema = createSignal(node.compiledSchema.peek())

    const dependencyOverrides = createSignal(node.dependencyOverrides.peek())

    const presentationStateSignal = createComputed(() => presentationState)

    previousNode = {
      ...node,
      compiledSchema,
      staticSchema: compiledSchema,
      dependencyOverrides,
      dynamicOverrides: dependencyOverrides,
      presentationState: presentationStateSignal,
      effectiveState: presentationStateSignal,
    }
  }

  applyNode(node, desired)
  const valueCleanupPath = updateDomainResources(node, previousNode, context)

  context.lifecycle.emitUpdated(node, previousNode)

  return valueCleanupPath
}

/**
 * 释放单个 Node 的 ViewSchema computed 和领域资源。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 需要释放资源的节点。
 * @param context - 表单运行时上下文。
 * @param options - 是否在卸载字段节点时删除其当前值。
 *
 * @example
 * ```ts
 * unmountNodeResources(node, context)
 * ```
 */
export function unmountNodeResources<TValues extends Values>(
  node: ContainerNode<TValues>,
  context: SchemaRuntimeContext<TValues>,
  options: NodeUnmountOptions = {}
): void {
  if (isRootNode(node)) {
    return
  }

  detachNodeViewSchemas(node)
  unmountDomainResources(node, context)

  if (isFieldNode(node) && options.isRemoveFieldValue === true) {
    context.store.removeFieldValue(node.name.peek())
  }

  context.lifecycle.emitUnmounted(node)
}

/**
 * 根据旧配置使用目标节点更新当前 Node 的领域资源。
 *
 * @param node - 实际树中被复用的节点。
 * @param previousNode - 更新前的节点快照。
 * @param context - 表单运行时上下文。
 */
function updateDomainResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  previousNode: SchemaNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): NamePath<TValues> | undefined {
  if (isFieldNode(node) && isFieldNode(previousNode)) {
    return updateFieldResources(node, previousNode, context)
  }

  if (isGroupNode(node) && isGroupNode(previousNode)) {
    updatePresentationResources(node, previousNode, context)

    return undefined
  }

  if (isDynamicNode(node) && isDynamicNode(previousNode)) {
    updatePresentationResources(node, previousNode, context)
    updateDynamicResources(node, previousNode, context)

    return undefined
  }

  if (isDependencyNode(node) && isDependencyNode(previousNode)) {
    updateDependencyResources(node, previousNode, context)

    return undefined
  }

  throw new Error(
    `unexpected runtime node type: node ${node.type} cannot update with ${previousNode.type}`
  )
}

/**
 * 按节点类型挂载领域资源。
 *
 * @param node - 需要挂载资源的节点。
 * @param context - 表单运行时上下文。
 */
function mountDomainResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (isFieldNode(node)) {
    mountFieldResources(node, context)

    return
  }

  if (isGroupNode(node)) {
    mountPresentationResources(node, context)

    return
  }

  if (isDynamicNode(node)) {
    mountPresentationResources(node, context)
    mountDynamicResources(node, context)

    return
  }

  mountDependencyResources(node, context)
}

/**
 * 按节点类型释放领域资源。
 *
 * @param node - 需要释放资源的节点。
 * @param context - 表单运行时上下文。
 */
function unmountDomainResources<TValues extends Values>(
  node: ContainerNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (isFieldNode(node)) {
    unmountFieldResources(node, context)

    return
  }

  if (isGroupNode(node)) {
    unmountPresentationResources(node)

    return
  }

  if (isDynamicNode(node)) {
    unmountDynamicResources(node)
    unmountPresentationResources(node)

    return
  }

  if (isDependencyNode(node)) {
    unmountDependencyResources(node)
  }
}

/**
 * 将 detached 节点的配置写入 Node。
 *
 * @param node - 待写入配置的节点。
 * @param desired - 已编译的下一轮 detached 节点。
 * @throws 当两个节点的类型不一致时抛出错误。
 */
function applyNode<TValues extends Values>(
  node: SchemaNode<TValues>,
  desired: SchemaNode<TValues>
): void {
  if (isFieldNode(node) && isFieldNode(desired)) {
    node.configToken = desired.configToken
    node.name.value = desired.name.peek()
    node.compiledSchema.value = desired.compiledSchema.peek()
    updateFieldDiagnostics(node, {
      lastUpdatedBy: "static-schema",
      triggerFields: [],
      overriddenKeys: [],
      error: null,
    })

    return
  }

  if (isGroupNode(node) && isGroupNode(desired)) {
    node.configToken = desired.configToken
    node.compiledSchema.value = desired.compiledSchema.peek()

    return
  }

  if (isDependencyNode(node) && isDependencyNode(desired)) {
    node.configToken = desired.configToken
    node.rendererContextKey = desired.rendererContextKey
    node.compiledSchema.value = desired.compiledSchema.peek()

    return
  }

  if (isDynamicNode(node) && isDynamicNode(desired)) {
    node.configToken = desired.configToken
    node.compiledSchema.value = desired.compiledSchema.peek()

    return
  }

  throw new Error(`unexpected runtime node type: ${desired.type}`)
}
