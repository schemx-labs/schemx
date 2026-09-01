/**
 * RuntimeNode 协调器。
 *
 * 统一编排 Compiler、NodeManager 与 RuntimeNodeLifecycle。
 *
 * @module core/runtime/reconciler
 */

import { isGroupSchema } from "../utils"

import { CompileError } from "./compiler"
import { findFieldRuntimeNode } from "./node/helper"

import type { Compile } from "./compiler"
import type { SchemxField, Values } from "../types"
import type { NodeManager } from "./node/nodeManager"
import type { RuntimeNodeLifecycle } from "./node/resources"
import type {
  ParentRuntimeNode,
  RuntimeNode,
  RuntimeNodeId,
  SchemaRuntimeNode,
} from "./node/types"

/**
 * RuntimeNode 协调器的唯一公开接口。
 *
 * Reconciler 根据 Schema 生成 detached 节点，与当前树按 key 进行复用、移动、更新或
 * 删除，并通过 RuntimeNodeLifecycle 管理资源边界。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * reconciler.reconcile(schemas)
 * ```
 */
export interface Reconciler<TValues extends Values = Values> {
  /**
   * 使用完整根 Schema 协调整棵 RuntimeNode 树。
   *
   * @param schemas - 新一轮根节点 Schema 列表。
   */
  reconcile(schemas: readonly SchemxField<TValues>[]): void
  /**
   * 协调指定 parent 下的直接 children。
   *
   * @param parentId - 要协调的父节点 id。
   * @param schemas - 新一轮直接子节点 Schema 列表。
   */
  reconcileChildren(
    parentId: RuntimeNodeId,
    schemas: readonly SchemxField<TValues>[]
  ): void
  /**
   * 移除节点及其子树，并完成生命周期清理。
   *
   * @param id - 要移除的 SchemaRuntimeNode id。
   */
  remove(id: RuntimeNodeId): void
  /**
   * 清空全部 SchemaRuntimeNode，保留 root。
   */
  clear(): void
}

interface CreateReconcilerOptions<TValues extends Values> {
  // 负责将 Schema 编译为 detached RuntimeNode。
  readonly compiler: Compile<TValues>
  // 负责维护当前 RuntimeNode 树结构。
  readonly nodeManager: NodeManager<TValues>
  // 负责节点资源与生命周期事件。
  readonly lifecycle: RuntimeNodeLifecycle<TValues>
}

interface RuntimeNodeUpdate<TValues extends Values> {
  // 树中被复用的当前节点。
  readonly current: SchemaRuntimeNode<TValues>
  // 编译出的下一轮节点配置。
  readonly desired: SchemaRuntimeNode<TValues>
}

/**
 * 创建 RuntimeNode 协调器。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler、NodeManager 和生命周期门面。
 * @returns 新的 Reconciler 实例。
 *
 * @example
 * ```ts
 * const reconciler = createReconciler({ compiler, nodeManager, lifecycle })
 * reconciler.reconcile(schemas)
 * ```
 */
export function createReconciler<TValues extends Values>(
  options: CreateReconcilerOptions<TValues>
): Reconciler<TValues> {
  const { compiler, lifecycle, nodeManager } = options

  // 根级协调复用同一套 children reconciliation 流程。
  const reconcile = (schemas: readonly SchemxField<TValues>[]): void => {
    reconcileChildren(nodeManager.getRoot().id, schemas)
  }

  // 先校验字段路径，再创建 detached 节点并协调当前 parent 的直接 children。
  const reconcileChildren = (
    parentId: RuntimeNodeId,
    schemas: readonly SchemxField<TValues>[]
  ): void => {
    const parent = requireParentNode(parentId)

    validateRuntimeFieldNames(parent, schemas)

    const desiredNodes = createDesiredNodes(parent, schemas)

    const children = reconcileNode(parent, desiredNodes)

    for (let index = 0; index < schemas.length; index += 1) {
      const schema = schemas[index]

      const node = children[index]

      if (node && schema && node.type === "group" && isGroupSchema(schema)) {
        reconcileChildren(node.id, schema.children)
      }
    }
  }

  // 统一通过资源清理流程移除节点。
  const remove = (id: RuntimeNodeId): void => {
    removeNode(id)
  }

  // NodeManager 只解除树结构，资源释放由 reconciler 补齐。
  const clear = (): void => {
    cleanupRemovedNodes(nodeManager.clear())
  }

  /**
   * 获取可承载子节点的父节点。
   *
   * @param parentId - 要读取的父节点 id。
   * @returns 合法的 ParentRuntimeNode。
   * @throws 当节点不存在或为 field 节点时抛出错误。
   */
  function requireParentNode(parentId: RuntimeNodeId): ParentRuntimeNode<TValues> {
    const node = nodeManager.get(parentId)

    if (!node) {
      throw new Error(`[schemx] RuntimeNode "${parentId}" does not exist`)
    }

    if (node.type === "field") {
      throw new Error(`[schemx] RuntimeNode "${parentId}" cannot contain children`)
    }

    return node
  }

  /**
   * 校验非根协调范围内的字段路径不会与其他子树重复。
   *
   * @param parent - 当前要协调的父节点。
   * @param schemas - 待校验的 Schema 列表。
   * @throws 发现字段路径已被其他子树占用时抛出 CompileError。
   */
  function validateRuntimeFieldNames(
    parent: ParentRuntimeNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): void {
    if (parent === nodeManager.getRoot()) {
      return
    }

    // 递归检查分组内部字段，并保留 Schema 位置用于诊断。
    const visit = (items: readonly SchemxField<TValues>[], location: string): void => {
      for (let index = 0; index < items.length; index += 1) {
        const schema = items[index]

        if (!schema) {
          continue
        }

        const schemaLocation = `${location}[${index}]`

        if (isGroupSchema(schema)) {
          visit(schema.children, `${schemaLocation}.children`)
          continue
        }

        if (!("name" in schema)) {
          continue
        }

        const existing = findFieldRuntimeNode(nodeManager.getRoot(), schema.name)

        if (existing && !isRuntimeNodeInSubtree(existing, parent)) {
          throw new CompileError(
            `[schemx] Duplicate field name "${schema.name}" at ${schemaLocation}; it is already used by runtime node "${existing.key}".`,
            schema
          )
        }
      }
    }

    visit(schemas, "schemas")
  }

  /**
   * 将 Schema 编译为 detached 节点，并检查同一 parent 下的 key 冲突。
   *
   * @param parent - detached 节点将要挂入的父节点。
   * @param schemas - 待编译的直接子节点 Schema 列表。
   * @returns 按 Schema 顺序排列的 detached 节点。
   * @throws 发现重复运行时 key 或任一节点编译失败时抛出错误。
   */
  function createDesiredNodes(
    parent: ParentRuntimeNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): SchemaRuntimeNode<TValues>[] {
    const nodes: SchemaRuntimeNode<TValues>[] = []

    const keys = new Set<string>()

    try {
      for (let index = 0; index < schemas.length; index += 1) {
        const schema = schemas[index]

        if (!schema) {
          continue
        }

        const node = createNode(parent, schema, index)

        if (keys.has(node.key)) {
          lifecycle.discard(node)

          throw new CompileError(
            `[schemx] Duplicate runtime node key "${node.key}".`,
            schema
          )
        }

        keys.add(node.key)
        nodes.push(node)
      }
    } catch (error) {
      for (const node of nodes) {
        lifecycle.discard(node)
      }

      throw error
    }

    return nodes
  }

  /**
   * 编译单个 Schema，并为节点创建独立的子资源作用域。
   *
   * @param parent - 节点的目标父节点。
   * @param schema - 要编译的 Schema。
   * @param index - Schema 在父节点 children 中的位置。
   * @returns 已发出 created 事件但尚未挂载的节点。
   */
  function createNode(
    parent: ParentRuntimeNode<TValues>,
    schema: SchemxField<TValues>,
    index: number
  ): SchemaRuntimeNode<TValues> {
    const node = compiler.createNode(schema, parent.key, index, parent.scope.child())

    lifecycle.created(node)

    return node
  }

  /**
   * 按稳定 key 协调一个父节点的直接 children。
   *
   * 同 key 且同类型的节点会复用；配置 token 变化时更新资源，类型变化或缺失时替换
   * 节点。挂载失败会回滚本轮树结构和已创建资源。
   *
   * @param parent - 当前要协调的父节点。
   * @param desiredNodes - 本轮编译出的 detached 节点。
   * @returns 协调完成后的直接子节点。
   */
  function reconcileNode(
    parent: ParentRuntimeNode<TValues>,
    desiredNodes: readonly SchemaRuntimeNode<TValues>[]
  ): readonly SchemaRuntimeNode<TValues>[] {
    const previousChildren = nodeManager.getChildren(parent.id)

    const currentByKey = indexCurrentNodes(previousChildren)

    const nextChildren: SchemaRuntimeNode<TValues>[] = []

    const mountedNodes: SchemaRuntimeNode<TValues>[] = []

    const updates: RuntimeNodeUpdate<TValues>[] = []

    const discardedNodes: SchemaRuntimeNode<TValues>[] = []

    const removedNodes: RuntimeNode<TValues>[] = []

    for (const desired of desiredNodes) {
      const current = currentByKey.get(desired.key)

      if (!current) {
        nextChildren.push(desired)
        continue
      }

      currentByKey.delete(desired.key)

      if (current.type !== desired.type) {
        nextChildren.push(desired)
        removedNodes.push(current)
        continue
      }

      nextChildren.push(current)
      discardedNodes.push(desired)

      if (current.configToken !== desired.configToken) {
        updates.push({ current, desired })
      }
    }

    for (const current of currentByKey.values()) {
      removedNodes.push(current)
    }

    try {
      nodeManager.transaction(() => {
        for (let index = 0; index < nextChildren.length; index += 1) {
          const node = nextChildren[index]

          if (!node) {
            continue
          }

          if (nodeManager.has(node.id)) {
            moveNode(node.id, parent.id, index)
            continue
          }

          nodeManager.insert(node, parent.id, index)
          mountedNodes.push(node)
          lifecycle.mount(node)
        }
      })

      for (const update of updates) {
        updateNode(update.current, update.desired)
      }
    } catch (error) {
      rollbackTree(parent, previousChildren, mountedNodes)

      for (const desired of desiredNodes) {
        lifecycle.discard(desired)
      }

      throw error
    }

    nodeManager.transaction(() => {
      for (const node of removedNodes) {
        removeNode(node.id)
      }
    })

    for (const node of discardedNodes) {
      lifecycle.discard(node)
    }

    return nodeManager.getChildren(parent.id)
  }

  /**
   * 将 detached 节点配置应用到树中已复用的节点。
   *
   * @param current - 树中保留的当前节点。
   * @param desired - 携带下一轮配置的 detached 节点。
   */
  function updateNode(
    current: SchemaRuntimeNode<TValues>,
    desired: SchemaRuntimeNode<TValues>
  ): void {
    lifecycle.update(current, desired)
  }

  /**
   * 仅在节点当前位置发生变化时执行移动。
   *
   * @param id - 要移动的节点 id。
   * @param parentId - 目标父节点 id。
   * @param index - 目标位置。
   */
  function moveNode(id: RuntimeNodeId, parentId: RuntimeNodeId, index: number): void {
    if (nodeManager.getIndex(id) !== index) {
      nodeManager.move(id, parentId, index)
    }
  }

  /**
   * 从 NodeManager 移除节点，并按卸载后释放的顺序清理资源。
   *
   * @param id - 要移除的节点 id。
   */
  function removeNode(id: RuntimeNodeId): void {
    cleanupRemovedNodes(nodeManager.remove(id))
  }

  /**
   * 先卸载整棵子树，再释放各节点作用域。
   *
   * @param removed - 按 preorder 排列的已移除节点。
   */
  function cleanupRemovedNodes(removed: readonly RuntimeNode<TValues>[]): void {
    for (const node of [...removed].reverse()) {
      lifecycle.unmount(node)
    }

    for (const node of [...removed].reverse()) {
      lifecycle.dispose(node)
    }
  }

  /**
   * 将树结构恢复到协调前状态，并移除本轮已挂载节点。
   *
   * @param parent - 本轮发生协调的父节点。
   * @param previousChildren - 协调前的直接子节点顺序。
   * @param mountedNodes - 本轮已成功挂载的节点。
   */
  function rollbackTree(
    parent: ParentRuntimeNode<TValues>,
    previousChildren: readonly SchemaRuntimeNode<TValues>[],
    mountedNodes: readonly SchemaRuntimeNode<TValues>[]
  ): void {
    nodeManager.transaction(() => {
      for (const node of [...mountedNodes].reverse()) {
        if (nodeManager.has(node.id)) {
          removeNode(node.id)
        }
      }

      for (let index = 0; index < previousChildren.length; index += 1) {
        const node = previousChildren[index]

        if (node && nodeManager.has(node.id)) {
          moveNode(node.id, parent.id, index)
        }
      }
    })
  }

  return {
    reconcile,
    reconcileChildren,
    remove,
    clear,
  }
}

/**
 * 按稳定 key 建立当前直接子节点索引。
 *
 * @typeParam TValues - 表单值类型。
 * @param children - 当前父节点的直接子节点。
 * @returns 以节点 key 为键的当前节点映射。
 */
function indexCurrentNodes<TValues extends Values>(
  children: readonly SchemaRuntimeNode<TValues>[]
): Map<string, SchemaRuntimeNode<TValues>> {
  const nodesByKey = new Map<string, SchemaRuntimeNode<TValues>>()

  for (const child of children) {
    nodesByKey.set(child.key, child)
  }

  return nodesByKey
}

/**
 * 判断节点是否位于指定父节点的子树中。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的节点。
 * @param parent - 候选父节点。
 * @returns 节点自身或其祖先链包含 `parent` 时返回 `true`。
 */
function isRuntimeNodeInSubtree<TValues extends Values>(
  node: RuntimeNode<TValues>,
  parent: ParentRuntimeNode<TValues>
): boolean {
  let current: RuntimeNode<TValues> | null = node

  while (current) {
    if (current === parent) {
      return true
    }

    current = current.parent
  }

  return false
}
