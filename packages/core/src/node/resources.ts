/**
 * Node 资源编排。
 *
 * 统一处理领域资源、ViewSchema computed 和节点配置，不通知业务生命周期钩子。
 *
 * @module core/node/resources
 */

import {
  mountDependencyResources,
  unmountDependencyResources,
  updateDependencyResources,
} from "../dependencies"
import {
  mountDynamicResources,
  unmountDynamicResources,
  updateDynamicResources,
} from "../dynamic"
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
import { batchUpdates, createComputed, createSignal } from "../reactivity"
import {
  createFieldKey,
  getSchemaKind,
  isDependencySchema,
  isDynamicSchema,
  isFieldSchema,
  isGroupSchema,
} from "../utils"
import { attachNodeViewSchemas, detachNodeViewSchemas } from "../view"

import {
  isDependencyNode,
  isDynamicNode,
  isFieldNode,
  isGroupNode,
  updateFieldDiagnostics,
} from "./index"

import type { ChildReconciler, FormRuntimeContext } from "../runtimeContext"
import type { ContainerNode, NodeManager, SchemaNode } from "./index"
import type { SchemaCompileResult } from "../compiler"
import type { NamePath, Values } from "../types"

/**
 * 挂载 Node 的领域资源和 ViewSchema computed。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 已挂入父节点的 Node。
 * @param context - 表单运行时上下文。
 * @param childReconciler - 挂载资源使用的子树协调能力。
 * @throws 节点尚未挂入父节点时抛出错误。
 *
 * @example
 * ```ts
 * mountNodeResources(node, context, childReconciler)
 * ```
 */
export function mountNodeResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  if (!node.parent) {
    throw new Error(
      `[schemx] Runtime node "${node.key}" must have a parent before mount.`
    )
  }

  mountDomainResources(node, context, childReconciler)
  attachNodeViewSchemas(node, context.debug)
}

/**
 * 使用纯编译配置更新 Node 的领域资源。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 实际树中被复用的节点。
 * @param previousNode - Reconciler 保存的更新前节点快照。
 * @param desired - 下一轮纯编译配置。
 * @param context - 表单运行时上下文。
 * @param childReconciler - 更新资源使用的子树协调能力。
 * @returns 旧 Schema 不保留值时返回待清理路径，由 Reconciler 在整批协调后处理。
 *
 * @example
 * ```ts
 * updateNodeResources(node, previousNode, compiledConfig, context, childReconciler)
 * ```
 */
export function updateNodeResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  previousNode: SchemaNode<TValues>,
  desired: SchemaCompileResult<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): NamePath<TValues> | undefined {
  // 旧路径在整批节点协调结束后再判断能否删除。
  let valueCleanupPath: NamePath<TValues> | undefined

  // 顺序：提交配置与路径索引、中止旧路径，再调整领域资源；批次结束后通知消费者。
  batchUpdates(() => {
    applyNodeConfig(node, desired, context.nodeManager)
    valueCleanupPath = updateDomainResources(node, previousNode, context, childReconciler)
  })

  return valueCleanupPath
}

/**
 * 释放单个 Node 的 ViewSchema computed 和领域资源。
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
  node: SchemaNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  // 卸载回调开始前使所有节点控制器失效，保留值由 preserve 单独决定。
  // 身份已随树结构移除退出活动索引；preserve 仅决定 Store 数据是否保留。
  node.disposed.value = true
  if (isFieldNode(node)) {
    node.pathController.abort()
  }

  detachNodeViewSchemas(node)
  unmountDomainResources(node, context)
}

/**
 * 幂等释放节点剩余作用域，也用于丢弃尚未挂载的节点。
 * @typeParam TValues - 表单值类型。
 * @param node - 已卸载或尚未挂载的节点。
 * @example disposeNodeResources(node)
 */
export function disposeNodeResources<TValues extends Values>(
  node: ContainerNode<TValues>
): void {
  if (node.scope.disposed) {
    return
  }

  node.disposed.value = true
  node.scope.dispose()
}

/**
 * 复制更新会改写的配置与派生态，Scope、effect 和树关系沿用原引用。
 * @typeParam TValues - 表单值类型。
 * @param node - 尚未写入本轮配置的活动节点。
 * @returns 与当前节点同类型的旧配置快照。
 * @example const previousNode = createNodeSnapshot(node)
 */
export function createNodeSnapshot<TValues extends Values>(
  node: SchemaNode<TValues>
): SchemaNode<TValues> {
  // 各类节点共用配置和依赖覆盖的复制方式，值来自同一个原节点。
  const snapshot = Object.assign({}, node, {
    compiledSchema: createSignal(node.compiledSchema.peek()),
    dependencyOverrides: createSignal(node.dependencyOverrides.peek()),
  })

  if (isFieldNode(snapshot)) {
    // 生效配置和校验切片必须先求值，不能继续追踪活动节点。
    const resolvedSchema = snapshot.resolvedSchema.peek()

    const validationState = snapshot.validationState.peek()

    const diagnostics = snapshot.diagnostics?.peek()

    return Object.assign(snapshot, {
      name: createSignal(snapshot.name.peek()),
      resolvedSchema: createComputed(() => resolvedSchema),
      validationState: createComputed(() => validationState),
      diagnostics: diagnostics === undefined ? undefined : createSignal(diagnostics),
    })
  }

  // Group、Dependency 和 Dynamic 共用固定的旧呈现态。
  const presentationState = snapshot.presentationState.peek()

  Object.assign(snapshot, {
    presentationState: createComputed(() => presentationState),
  })

  if (isDynamicNode(snapshot)) {
    // 数组后续重排只替换活动行列表，不影响此次快照。
    return Object.assign(snapshot, {
      dynamicRows: createSignal(snapshot.dynamicRows.peek()),
    })
  }

  return snapshot
}

/**
 * 根据旧配置使用目标节点更新当前 Node 的领域资源。
 *
 * @param node - 实际树中被复用的节点。
 * @param previousNode - 更新前的节点快照。
 * @param context - 表单运行时上下文。
 * @param childReconciler - Dependency 和 Dynamic 资源使用的子树协调能力。
 * @returns 字段改名后需要延迟清理的旧路径，其他节点返回 undefined。
 */
function updateDomainResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  previousNode: SchemaNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
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
    updateDynamicResources(node, previousNode, context, childReconciler)

    return undefined
  }

  if (isDependencyNode(node) && isDependencyNode(previousNode)) {
    updateDependencyResources(node, previousNode, context, childReconciler)

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
 * @param childReconciler - Dependency 和 Dynamic 资源使用的子树协调能力。
 */
function mountDomainResources<TValues extends Values>(
  node: SchemaNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
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
    mountDynamicResources(node, context, childReconciler)

    return
  }

  mountDependencyResources(node, context, childReconciler)
}

/**
 * 按节点类型释放领域资源。
 *
 * @param node - 需要释放资源的节点。
 * @param context - 数组行注销使用的 Runtime 上下文。
 */
function unmountDomainResources<TValues extends Values>(
  node: ContainerNode<TValues>,
  context: FormRuntimeContext<TValues>
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
    unmountDynamicResources(node, context)
    unmountPresentationResources(node)

    return
  }

  if (isDependencyNode(node)) {
    unmountDependencyResources(node)
  }
}

/**
 * 将纯编译配置写入活动 Node。
 *
 * @param node - 待写入配置的节点。
 * @param desired - 已编译的下一轮配置。
 * @param nodeManager - 同步当前路径状态与索引的管理器。
 * @throws 当两个节点的类型不一致时抛出错误。
 */
function applyNodeConfig<TValues extends Values>(
  node: SchemaNode<TValues>,
  desired: SchemaCompileResult<TValues>,
  nodeManager: NodeManager<TValues>
): void {
  if (isFieldNode(node) && isFieldSchema(desired.schema)) {
    const previousPathController =
      createFieldKey(node.name.peek()) !== createFieldKey(desired.schema.name)
        ? node.pathController
        : undefined

    if (previousPathController) {
      node.pathController = new AbortController()
    }

    node.configToken = desired.configToken
    node.compiledSchema.value = desired.schema
    nodeManager.updatePaths([{ nodeId: node.id, path: desired.schema.name }])
    previousPathController?.abort()
    updateFieldDiagnostics(node, {
      lastUpdatedBy: "static-schema",
      triggerFields: [],
      overriddenKeys: [],
      error: null,
    })

    return
  }

  if (isGroupNode(node) && isGroupSchema(desired.schema)) {
    node.configToken = desired.configToken
    node.compiledSchema.value = desired.schema

    return
  }

  if (isDependencyNode(node) && isDependencySchema(desired.schema)) {
    node.configToken = desired.configToken
    node.dynamicRow = desired.dynamicRow
    node.compiledSchema.value = desired.schema

    return
  }

  if (isDynamicNode(node) && isDynamicSchema(desired.schema)) {
    node.configToken = desired.configToken
    node.compiledSchema.value = desired.schema
    nodeManager.updatePaths([
      {
        nodeId: node.id,
        path: desired.schema.name as NamePath<TValues>,
      },
    ])

    return
  }

  throw new Error(`unexpected runtime node type: ${getSchemaKind(desired.schema)}`)
}
