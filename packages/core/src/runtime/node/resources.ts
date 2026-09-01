/**
 * RuntimeNode 资源编排。
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
  mountFieldResources,
  unmountFieldResources,
  updateFieldResources,
} from "../field"
import {
  mountPresentationResources,
  unmountPresentationResources,
  updatePresentationResources,
} from "../presentation"
import {
  clearRuntimeViewSchemas,
  createRuntimeViewSchemas,
} from "../view/createViewSchemas"

import { updateFieldDiagnostics } from "./helper"

import type {
  NamePath,
  SchemxContainerDependencies,
  SchemxFieldDependencies,
  Values,
} from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode, RuntimeNode, SchemaRuntimeNode } from "./types"

/**
 * 更新领域资源前从当前节点读取的配置快照。
 *
 * @typeParam TValues - 表单值类型。
 */
type PreviousRuntimeConfig<TValues extends Values> =
  | {
      readonly type: "field"
      readonly name: NamePath<TValues>
      readonly dynamicConfig: SchemxFieldDependencies<TValues> | undefined
    }
  | {
      readonly type: "group"
      readonly dynamicConfig: SchemxContainerDependencies<TValues> | undefined
    }
  | {
      readonly type: "dependency"
      readonly triggerFields: readonly NamePath<TValues>[]
      readonly rendererIdentity: DependencyRuntimeNode<TValues>["staticSchema"]["value"]["renderer"]
      readonly dynamicConfig: SchemxContainerDependencies<TValues> | undefined
    }

/**
 * RuntimeNode 的资源与生命周期编排门面。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface RuntimeNodeLifecycle<TValues extends Values = Values> {
  /**
   * 记录节点已创建，并转发创建事件。
   *
   * @param node - 新创建的 SchemaRuntimeNode。
   */
  created(node: SchemaRuntimeNode<TValues>): void
  /**
   * 挂载节点的领域资源和 ViewSchema computed。
   *
   * @param node - 已挂入节点树的 SchemaRuntimeNode。
   */
  mount(node: SchemaRuntimeNode<TValues>): void
  /**
   * 使用 detached 节点更新当前节点及其领域资源。
   *
   * @param current - 树中被复用的当前节点。
   * @param desired - 携带下一轮配置的 detached 节点。
   */
  update(current: SchemaRuntimeNode<TValues>, desired: SchemaRuntimeNode<TValues>): void
  /**
   * 卸载节点的 ViewSchema computed 和领域资源。
   *
   * @param node - 要卸载的 RuntimeNode。
   */
  unmount(node: RuntimeNode<TValues>): void
  /**
   * 释放节点的资源作用域。
   *
   * @param node - 要释放的 RuntimeNode。
   */
  dispose(node: RuntimeNode<TValues>): void
  /**
   * 丢弃尚未挂载的节点及其资源作用域。
   *
   * @param node - 要丢弃的 SchemaRuntimeNode。
   */
  discard(node: SchemaRuntimeNode<TValues>): void
}

/**
 * 创建 RuntimeNode 生命周期门面。
 *
 * @typeParam TValues - 表单值类型。
 * @param context - 表单运行时上下文。
 * @returns 供 reconciler 调用的资源与生命周期操作集合。
 *
 * @example
 * ```ts
 * const lifecycle = createRuntimeNodeLifecycle(context)
 * lifecycle.mount(node)
 * ```
 */
export function createRuntimeNodeLifecycle<TValues extends Values>(
  context: SchemaRuntimeContext<TValues>
): RuntimeNodeLifecycle<TValues> {
  // 创建事件只负责通知，不创建节点资源。
  const created = (node: SchemaRuntimeNode<TValues>): void => {
    context.lifecycle.emitCreated(node)
  }

  // 挂载领域资源、ViewSchema computed，并在完成后发布 mounted 事件。
  const mount = (node: SchemaRuntimeNode<TValues>): void => {
    mountNodeResources(node, context)
  }

  // 更新当前节点的配置和资源，并发布 updated 事件。
  const update = (
    current: SchemaRuntimeNode<TValues>,
    desired: SchemaRuntimeNode<TValues>
  ): void => {
    updateNodeResources(current, desired, context)
  }

  // 卸载 ViewSchema computed 和领域资源，但不释放节点自身 scope。
  const unmount = (node: RuntimeNode<TValues>): void => {
    unmountNodeResources(node, context)
  }

  // 幂等释放节点 scope；discard 复用同一释放语义。
  const dispose = (node: RuntimeNode<TValues>): void => {
    if (node.disposed.value) {
      return
    }

    node.disposed.value = true
    node.scope.dispose()
  }

  return {
    created,
    mount,
    update,
    unmount,
    dispose,
    discard: dispose,
  }
}

/**
 * 挂载 RuntimeNode 的领域资源和 ViewSchema computed。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 已挂入父节点的 RuntimeNode。
 * @param context - 表单运行时上下文。
 * @throws 节点尚未挂入父节点时抛出错误。
 *
 * @example
 * ```ts
 * mountNodeResources(node, context)
 * ```
 */
export function mountNodeResources<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (!node.parent) {
    throw new Error(
      `[schemx] Runtime node "${node.key}" must have a parent before mount.`
    )
  }

  mountDomainResources(node, context)
  createRuntimeViewSchemas(node, context.debug)
  context.lifecycle.emitMounted(node)
}

/**
 * 使用目标节点配置更新 RuntimeNode 的领域资源。
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
  node: SchemaRuntimeNode<TValues>,
  desired: SchemaRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (node.type !== desired.type) {
    throw new Error(
      `unexpected runtime node type: node ${node.type} cannot update with ${desired.type}`
    )
  }

  const previousNode = createRuntimeNodeSnapshot(node)

  const previousConfig = readRuntimeConfig(node)

  applyRuntimeNode(node, desired)
  updateDomainResources(node, previousConfig, context)
  context.lifecycle.emitUpdated(node, previousNode)
}

/**
 * 释放单个 RuntimeNode 的 ViewSchema computed 和领域资源。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 需要释放资源的节点。
 * @param context - 表单运行时上下文。
 *
 * @example
 * ```ts
 * unmountNodeResources(node, context)
 * ```
 */
export function unmountNodeResources<TValues extends Values>(
  node: RuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (node.type === "root") {
    return
  }

  clearRuntimeViewSchemas(node)
  unmountDomainResources(node, context)
  context.lifecycle.emitUnmounted(node)
}

/**
 * 根据旧配置使用目标节点更新当前 RuntimeNode 的领域资源。
 *
 * @param node - 实际树中被复用的节点。
 * @param previousConfig - 更新前从当前节点读取的配置。
 * @param context - 表单运行时上下文。
 */
function updateDomainResources<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>,
  previousConfig: PreviousRuntimeConfig<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (node.type === "field" && previousConfig.type === "field") {
    updateFieldResources(node, previousConfig.name, previousConfig.dynamicConfig, context)

    return
  }

  if (node.type === "group" && previousConfig.type === "group") {
    updatePresentationResources(node, previousConfig.dynamicConfig, context)

    return
  }

  if (node.type === "dependency" && previousConfig.type === "dependency") {
    updateDependencyResources(
      node,
      previousConfig.triggerFields,
      previousConfig.rendererIdentity,
      previousConfig.dynamicConfig,
      context
    )
  }
}

/**
 * 按节点类型挂载领域资源。
 *
 * @param node - 需要挂载资源的节点。
 * @param context - 表单运行时上下文。
 */
function mountDomainResources<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (node.type === "field") {
    mountFieldResources(node, context)

    return
  }

  if (node.type === "group") {
    mountPresentationResources(node, context)

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
  node: RuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (node.type === "field") {
    unmountFieldResources(node, context)

    return
  }

  if (node.type === "group") {
    unmountPresentationResources(node)

    return
  }

  if (node.type === "dependency") {
    unmountDependencyResources(node)
  }
}

/**
 * 将 detached 节点的配置写入 RuntimeNode。
 *
 * @param node - 待写入配置的节点。
 * @param desired - 已编译的下一轮 detached 节点。
 * @throws 当两个节点的类型不一致时抛出错误。
 */
function applyRuntimeNode<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>,
  desired: SchemaRuntimeNode<TValues>
): void {
  if (node.type !== desired.type) {
    throw new Error(`unexpected runtime node type: ${desired.type}`)
  }

  node.configToken = desired.configToken

  if (node.type === "field" && desired.type === "field") {
    node.name.value = desired.name.value
    node.staticSchema.value = desired.staticSchema.value
    updateFieldDiagnostics(node, {
      lastUpdatedBy: "static-schema",
      triggerFields: [],
      overriddenKeys: [],
      error: null,
    })

    return
  }

  if (node.type === "group" && desired.type === "group") {
    node.staticSchema.value = desired.staticSchema.value

    return
  }

  if (node.type === "dependency" && desired.type === "dependency") {
    node.staticSchema.value = desired.staticSchema.value
  }
}

/**
 * 创建更新前的 RuntimeNode 配置快照，避免旧节点与新 Signal 共享引用。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要复制配置的 SchemaRuntimeNode。
 * @returns 使用独立 Signal 保存旧配置的节点快照。
 */
function createRuntimeNodeSnapshot<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>
): SchemaRuntimeNode<TValues> {
  if (node.type === "field") {
    const effectiveSchema = node.effectiveSchema.peek()

    const validationSchema = node.validationSchema.peek()

    const diagnostics = node.diagnostics?.peek()

    return {
      ...node,
      name: createSignal(node.name.peek()),
      staticSchema: createSignal(node.staticSchema.peek()),
      dynamicOverrides: createSignal(node.dynamicOverrides.peek()),
      effectiveSchema: createComputed(() => effectiveSchema),
      validationSchema: createComputed(() => validationSchema),
      diagnostics: diagnostics === undefined ? undefined : createSignal(diagnostics),
    }
  }

  if (node.type === "group") {
    const effectiveState = node.effectiveState.peek()

    return {
      ...node,
      staticSchema: createSignal(node.staticSchema.peek()),
      dynamicOverrides: createSignal(node.dynamicOverrides.peek()),
      effectiveState: createComputed(() => effectiveState),
    }
  }

  const effectiveState = node.effectiveState.peek()

  return {
    ...node,
    staticSchema: createSignal(node.staticSchema.peek()),
    dynamicOverrides: createSignal(node.dynamicOverrides.peek()),
    effectiveState: createComputed(() => effectiveState),
  }
}

/**
 * 在写入新 Signal 值前读取本轮资源更新所需的旧配置。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要读取配置的 SchemaRuntimeNode。
 * @returns 与节点类型对应的旧配置快照。
 */
function readRuntimeConfig<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>
): PreviousRuntimeConfig<TValues> {
  if (node.type === "field") {
    return {
      type: "field",
      name: node.name.peek(),
      dynamicConfig: node.staticSchema.peek().dependencies,
    }
  }

  if (node.type === "group") {
    return {
      type: "group",
      dynamicConfig: node.staticSchema.peek().dependencies,
    }
  }

  return {
    type: "dependency",
    triggerFields: node.staticSchema.peek().to,
    rendererIdentity: node.staticSchema.peek().renderer,
    dynamicConfig: node.staticSchema.peek().dependencies,
  }
}
