/**
 * Node 协调器。
 *
 * 统一编排 Compiler、NodeManager 与 NodeLifecycle。
 *
 * @module core/runtime/reconciler
 */

import {
  createFieldKey,
  isDependencySchema,
  isDescendantFieldPath,
  isDynamicSchema,
  isFieldSchema,
  isGroupSchema,
  isValidSchema,
} from "../utils"

import { CompileError } from "./compiler"
import { createNodeKey } from "./compiler/helper"
import {
  isDependencyNode,
  isDynamicNode,
  isFieldNode,
  isGroupNode,
  isParentNode,
} from "./node/helper"

import type { Compile } from "./compiler"
import type { NamePath, SchemxField, Values } from "../types"
import type { NodeManager } from "./node/nodeManager"
import type { NodeLifecycle } from "./node/resources"
import type { ContainerNode, NodeId, ParentNode, SchemaNode } from "./node/types"

/**
 * Node 协调器的唯一公开接口。
 *
 * Reconciler 根据 Schema 生成 detached 节点，与当前树按 key 进行复用、移动、更新或
 * 删除，并通过 NodeLifecycle 管理资源边界。
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
   * 使用完整根 Schema 协调整棵 Node 树。
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
  reconcileChildren(parentId: NodeId, schemas: readonly SchemxField<TValues>[]): void
  /**
   * 使用最近一次成功提交的 Schema 刷新已挂载节点的静态配置。
   */
  refresh(): void
  /**
   * 清空全部 SchemaNode，保留 root。
   */
  clear(): void
}

interface CreateReconcilerOptions<TValues extends Values> {
  // 负责将 Schema 编译为 detached Node。
  readonly compiler: Compile<TValues>
  // 负责维护当前 Node 树结构。
  readonly nodeManager: NodeManager<TValues>
  // 负责节点资源与生命周期事件。
  readonly lifecycle: NodeLifecycle<TValues>
}

interface NodeUpdate<TValues extends Values> {
  // 树中被复用的当前节点。
  readonly current: SchemaNode<TValues>
  // 编译出的下一轮节点配置。
  readonly desired: SchemaNode<TValues>
}

/** 保留 Schema 与其 detached Node 的对应关系，过滤无效 Schema 后仍可递归协调。 */
interface DesiredNode<TValues extends Values> {
  /** 通过结构校验的原始 Schema。 */
  readonly schema: SchemxField<TValues>
  /** 由 Compiler 创建但尚未挂载的 Node。 */
  readonly node: SchemaNode<TValues>
}

/**
 * 单次 children 协调产生的新节点和待清理旧节点。
 */
interface ReconcileNodeResult<TValues extends Values> {
  /**
   * 协调完成后的直接子节点，顺序与输入 Schema 一致。
   */
  readonly children: readonly SchemaNode<TValues>[]
  /**
   * 已从树中移除、等待生命周期清理的节点。
   */
  readonly removed: readonly ContainerNode<TValues>[]
  /**
   * 字段改名后延迟到整批协调完成后再判断是否删除的旧路径。
   */
  readonly deferredValueRemovals: readonly NamePath<TValues>[]
}

/**
 * 创建 Node 协调器。
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

  // 保存每个容器最近一次成功提交的原始 Schema，供默认配置刷新复用。
  const committedSchemas = new Map<NodeId, readonly SchemxField<TValues>[]>()

  /**
   * 以 root 为父节点协调整棵 Schema 树。
   *
   * @param schemas - 新一轮根节点 Schema 列表。
   */
  const reconcile = (schemas: readonly SchemxField<TValues>[]): void => {
    reconcileChildren(nodeManager.getRoot().id, schemas)
  }

  /**
   * 先校验字段路径，再创建 detached 节点并协调当前 parent 的直接 children。
   *
   * @param parentId - 要协调的父节点 id。
   * @param schemas - 新一轮直接子节点 Schema 列表。
   */
  const reconcileChildren = (
    parentId: NodeId,
    schemas: readonly SchemxField<TValues>[],
    skipRuntimeFieldValidation = false
  ): void => {
    const parent = requireParentNode(parentId)

    const validSchemas = prepareSchemas(parent, schemas)

    if (!skipRuntimeFieldValidation) {
      validateRuntimeFieldNames(parent, schemas, validSchemas)
    }

    const desiredNodes = createDesiredNodes(parent, schemas, validSchemas)

    const result = reconcileNode(
      parent,
      desiredNodes.map(({ node }) => node)
    )

    try {
      for (let index = 0; index < desiredNodes.length; index += 1) {
        const desired = desiredNodes[index]

        const node = result.children[index]

        if (node && desired && isGroupNode(node) && isGroupSchema(desired.schema)) {
          reconcileChildren(node.id, desired.schema.children, true)
        }
      }
    } catch (error) {
      cleanupRemovedNodes(result.removed)

      throw error
    }

    cleanupRemovedNodes(result.removed)
    cleanupDeferredFieldValues(result.deferredValueRemovals)
    committedSchemas.set(parent.id, schemas)
  }

  /**
   * 使用最近成功提交的原始 Schema 刷新默认配置。
   *
   * Root/Group 子树会由普通递归协调刷新；Dependency/Dynamic 的 renderer 输出不会
   * 重新执行，而是使用上次成功结果再次协调，使默认配置能传播到已生成字段。
   */
  const refresh = (): void => {
    const root = nodeManager.getRoot()

    const rootSchemas = committedSchemas.get(root.id)

    if (!rootSchemas) {
      return
    }

    reconcileChildren(root.id, rootSchemas)

    const generatedParentIds = nodeManager
      .values()
      .filter((node) => isDependencyNode(node) || isDynamicNode(node))
      .map((node) => node.id)

    for (const parentId of generatedParentIds) {
      const parent = nodeManager.get(parentId)

      const schemas = committedSchemas.get(parentId)

      if (!parent || !isParentNode(parent) || !schemas) {
        continue
      }

      reconcileChildren(parentId, schemas)
    }
  }

  // NodeManager 只解除树结构，资源释放由 reconciler 补齐。
  const clear = (): void => {
    cleanupRemovedNodes(nodeManager.clear())
    committedSchemas.delete(nodeManager.getRoot().id)
  }

  /**
   * 获取可承载子节点的父节点。
   *
   * @param parentId - 要读取的父节点 id。
   * @returns 合法的 ParentNode。
   * @throws 当节点不存在或为 field 节点时抛出错误。
   */
  function requireParentNode(parentId: NodeId): ParentNode<TValues> {
    const node = nodeManager.get(parentId)

    if (!node) {
      throw new Error(`[schemx] Node "${parentId}" does not exist`)
    }

    if (!isParentNode(node)) {
      throw new Error(`[schemx] Node "${parentId}" cannot contain children`)
    }

    return node
  }

  /**
   * 按本次提交后的候选树检查字段路径冲突。
   *
   * 当前 parent 子树会被候选 Schema 替换，因此先从占用表中排除该子树，再把
   * 候选字段和仍会复用的 Dependency/Dynamic 输出加入检查，避免迁移时误报或
   * 静态字段遮蔽已生成字段。
   */
  function validateRuntimeFieldNames(
    parent: ParentNode<TValues>,
    schemas: readonly SchemxField<TValues>[],
    validSchemas: ReadonlySet<SchemxField<TValues>>
  ): void {
    // Dynamic 行是逐个 Dependency effect 提交的；数组重排期间其他行仍保留上一轮
    // 索引，不能把这种短暂重叠当成最终 Schema 冲突。
    if (hasDynamicAncestor(parent)) {
      return
    }

    const fields = new Map<
      string,
      { readonly location: string; readonly runtimeKey?: string }
    >()

    const excludedNodeIds = new Set(
      nodeManager.getDescendants(parent.id).map((node) => node.id)
    )

    for (const current of nodeManager.values()) {
      if (
        !isFieldNode(current) ||
        excludedNodeIds.has(current.id) ||
        isNodeInSubtree(current, parent)
      ) {
        continue
      }

      fields.set(createFieldKey(current.name.peek()), {
        location: "runtime",
        runtimeKey: current.key,
      })
    }

    const addField = (
      name: NamePath<TValues>,
      location: string,
      schema: SchemxField<TValues>
    ): void => {
      const fieldKey = createFieldKey(name)

      const previous = fields.get(fieldKey)

      if (previous) {
        if (previous.runtimeKey) {
          throw new CompileError(
            `[schemx] Duplicate field name "${name}" at ${location}; it is already used by runtime node "${previous.runtimeKey}".`,
            schema
          )
        }

        throw new CompileError(
          `[schemx] Duplicate field name "${name}" at ${previous.location} and ${location}.`,
          schema
        )
      }

      fields.set(fieldKey, { location })
    }

    const visit = (
      items: readonly SchemxField<TValues>[],
      currentParent: ParentNode<TValues>,
      parentKey: string,
      location: string,
      filterDirect = false
    ): void => {
      for (let index = 0; index < items.length; index += 1) {
        const schema = items[index]

        if (!schema || (filterDirect && !validSchemas.has(schema))) {
          continue
        }

        const schemaLocation = `${location}[${index}]`

        const key = createNodeKey(schema, index, parentKey)

        const current = nodeManager
          .getChildren(currentParent.id)
          .find((child) => child.key === key)

        if (isFieldSchema(schema)) {
          addField(schema.name, schemaLocation, schema)
          continue
        }

        if (isGroupSchema(schema)) {
          const nestedParent = isGroupNode(current) ? current : currentParent

          visit(schema.children, nestedParent, key, `${schemaLocation}.children`)
          continue
        }

        if (isDynamicSchema(schema)) {
          addField(schema.name as NamePath<TValues>, schemaLocation, schema)
        }

        const reusableGeneratedParent =
          (isDependencySchema(schema) && isDependencyNode(current)) ||
          (isDynamicSchema(schema) && isDynamicNode(current))

        if (reusableGeneratedParent && current) {
          for (const descendant of nodeManager.getDescendants(current.id)) {
            if (isFieldNode(descendant)) {
              addField(descendant.name.peek(), `${schemaLocation}.renderer`, schema)
            }
          }
        }
      }
    }

    visit(schemas, parent, parent.key, "schemas", true)
  }

  /**
   * 判断协调范围是否位于 Dynamic 数组节点下。
   */
  function hasDynamicAncestor(node: ParentNode<TValues>): boolean {
    let current: ContainerNode<TValues> | null = node

    while (current) {
      if (isDynamicNode(current)) {
        return true
      }

      current = current.parent
    }

    return false
  }

  /**
   * 将 Schema 编译为 detached 节点，并检查同一 parent 下的 key 冲突。
   *
   * @param parent - detached 节点将要挂入的父节点。
   * @param schemas - 待编译的直接子节点 Schema 列表。
   * @returns 按有效 Schema 顺序排列的 Schema/Node 对应项。
   * @throws 发现重复运行时 key 或任一节点编译失败时抛出错误。
   */
  function createDesiredNodes(
    parent: ParentNode<TValues>,
    schemas: readonly SchemxField<TValues>[],
    validSchemas: ReadonlySet<SchemxField<TValues>>
  ): DesiredNode<TValues>[] {
    const desiredNodes: DesiredNode<TValues>[] = []

    const keys = new Set<string>()

    try {
      for (let index = 0; index < schemas.length; index += 1) {
        const schema = schemas[index]

        if (!schema) {
          continue
        }

        if (!validSchemas.has(schema)) {
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
        desiredNodes.push({ schema, node })
      }
    } catch (error) {
      for (const { node } of desiredNodes) {
        lifecycle.discard(node)
      }

      throw error
    }

    return desiredNodes
  }

  /**
   * 在任何树结构提交前完成静态 Schema 校验和递归 key 校验。
   *
   * 该阶段只读取输入并构造校验集合，不创建 Node、不触发生命周期事件，也不修改
   * 当前树；因此嵌套 Group 的重复 key 不会留下已经挂载的空父节点。
   */
  function prepareSchemas(
    parent: ParentNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): ReadonlySet<SchemxField<TValues>> {
    const validSchemas = new Set<SchemxField<TValues>>()

    const fieldLocations = new Map<string, string>()

    const keys = new Set<string>()

    for (let index = 0; index < schemas.length; index += 1) {
      const schema = schemas[index]

      if (!schema || !isValidSchema(schema)) {
        continue
      }

      const location = `schemas[${index}]`

      const key = createNodeKey(schema, index, parent.key)

      registerSchemaFieldNames(schema, location, fieldLocations)

      if (keys.has(key)) {
        throw new CompileError(`[schemx] Duplicate runtime node key "${key}".`, schema)
      }

      keys.add(key)
      validateNestedSchemaKeys(schema, key, location)
      validSchemas.add(schema)
    }

    return validSchemas
  }

  /**
   * 递归检查 Group 和 Dynamic 模板中的运行时 key，覆盖尚未展开的静态子树。
   */
  function validateNestedSchemaKeys(
    schema: SchemxField<TValues>,
    parentKey: string,
    location: string
  ): void {
    if (isGroupSchema(schema)) {
      validateSchemaListKeys(schema.children, parentKey, `${location}.children`)

      return
    }

    if (isDynamicSchema(schema)) {
      validateSchemaListKeys(
        schema.item as readonly SchemxField<TValues>[],
        `${parentKey}/__row__`,
        `${location}.item`
      )
    }
  }

  function validateSchemaListKeys(
    schemas: readonly SchemxField<TValues>[],
    parentKey: string,
    location: string
  ): void {
    const keys = new Set<string>()

    for (let index = 0; index < schemas.length; index += 1) {
      const schema = schemas[index]

      if (!schema) {
        continue
      }

      const schemaLocation = `${location}[${index}]`

      const key = createNodeKey(schema, index, parentKey)

      if (keys.has(key)) {
        throw new CompileError(`[schemx] Duplicate runtime node key "${key}".`, schema)
      }

      keys.add(key)
      validateNestedSchemaKeys(schema, key, schemaLocation)
    }
  }

  /**
   * 注册当前静态 Schema 树中的字段名，并检测本轮提交的跨节点重复。
   *
   * @param schema - 要登记字段路径的 Schema。
   * @param location - Schema 在本轮提交中的诊断路径。
   * @param locations - 当前提交已登记的字段路径集合。
   */
  function registerSchemaFieldNames(
    schema: SchemxField<TValues>,
    location: string,
    locations: Map<string, string>
  ): void {
    if (isGroupSchema(schema)) {
      for (let index = 0; index < schema.children.length; index += 1) {
        const child = schema.children[index]

        if (child) {
          registerSchemaFieldNames(child, `${location}.children[${index}]`, locations)
        }
      }

      return
    }

    if (!isFieldSchema(schema) && !isDynamicSchema(schema)) {
      return
    }

    const fieldKey = createFieldKey(schema.name)

    const previousLocation = locations.get(fieldKey)

    if (previousLocation) {
      throw new CompileError(
        `[schemx] Duplicate field name "${schema.name}" at ${previousLocation} and ${location}.`,
        schema
      )
    }

    locations.set(fieldKey, location)
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
    parent: ParentNode<TValues>,
    schema: SchemxField<TValues>,
    index: number
  ): SchemaNode<TValues> {
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
   * @returns 协调完成后的直接子节点及待清理旧节点。
   */
  function reconcileNode(
    parent: ParentNode<TValues>,
    desiredNodes: readonly SchemaNode<TValues>[]
  ): ReconcileNodeResult<TValues> {
    const previousChildren = nodeManager.getChildren(parent.id)

    const currentByKey = indexCurrentNodes(previousChildren)

    const nextChildren: SchemaNode<TValues>[] = []

    const updates: NodeUpdate<TValues>[] = []

    const deferredValueRemovals: NamePath<TValues>[] = []

    const discardedNodes: SchemaNode<TValues>[] = []

    const removedNodes: ContainerNode<TValues>[] = []

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

    const orderChanged = !areNodeOrdersEqual(previousChildren, nextChildren)

    const canReorderInPlace =
      removedNodes.length === 0 && nextChildren.every((node) => nodeManager.has(node.id))

    try {
      nodeManager.transaction(() => {
        if (orderChanged && canReorderInPlace) {
          nodeManager.reorderChildren(parent.id, nextChildren)
        }

        for (let index = 0; index < nextChildren.length; index += 1) {
          const node = nextChildren[index]

          if (!node) {
            continue
          }

          if (nodeManager.has(node.id)) {
            if (orderChanged && !canReorderInPlace) {
              moveNode(node.id, parent.id, index)
            }

            continue
          }

          nodeManager.insert(node, parent.id, index)
          lifecycle.mount(node)
        }
      })

      for (const update of updates) {
        const cleanupPath = lifecycle.update(update.current, update.desired)

        if (cleanupPath) {
          deferredValueRemovals.push(cleanupPath)
        }
      }
    } catch (error) {
      rollbackTree(parent, previousChildren)

      for (const desired of desiredNodes) {
        lifecycle.discard(desired)
      }

      throw error
    }

    const removed: ContainerNode<TValues>[] = []

    nodeManager.transaction(() => {
      for (const node of removedNodes) {
        removed.push(...nodeManager.remove(node.id))
      }
    })

    for (const node of discardedNodes) {
      lifecycle.discard(node)
    }

    return {
      children: nodeManager.getChildren(parent.id),
      removed,
      deferredValueRemovals,
    }
  }

  /**
   * 仅在节点当前位置发生变化时执行移动。
   *
   * @param id - 要移动的节点 id。
   * @param parentId - 目标父节点 id。
   * @param index - 目标位置。
   */
  function moveNode(id: NodeId, parentId: NodeId, index: number): void {
    if (nodeManager.getIndex(id) !== index) {
      nodeManager.move(id, parentId, index)
    }
  }

  /**
   * 从 NodeManager 移除节点，并按卸载后释放的顺序清理资源。
   *
   * @param id - 要移除的节点 id。
   */
  function removeNode(id: NodeId): void {
    cleanupRemovedNodes(nodeManager.remove(id))
  }

  /**
   * 先卸载整棵子树，再释放各节点作用域。
   *
   * @param removed - 按 preorder 排列的已移除节点。
   */
  function cleanupRemovedNodes(removed: readonly ContainerNode<TValues>[]): void {
    for (const node of removed) {
      committedSchemas.delete(node.id)
    }

    for (const node of [...removed].reverse()) {
      lifecycle.unmount(node, {
        isRemoveFieldValue: shouldRemoveFieldValue(node),
      })
    }

    for (const node of [...removed].reverse()) {
      lifecycle.dispose(node)
    }
  }

  /**
   * 在当前 parent 的新旧节点都完成协调后清理真正失去归属的旧字段路径。
   *
   * 延后到整批提交结束，可以区分普通字段改名和 Dynamic 行索引变化；后者的旧路径
   * 通常已经被另一行字段占用，不应删除其当前值。
   */
  function cleanupDeferredFieldValues(paths: readonly NamePath<TValues>[]): void {
    if (paths.length === 0) {
      return
    }

    const activeFields = nodeManager.values().filter(isFieldNode)

    const seen = new Set<string>()

    for (const path of paths) {
      const pathKey = createFieldKey(path)

      if (seen.has(pathKey)) {
        continue
      }

      seen.add(pathKey)

      const stillUsed = activeFields.some(
        (field) =>
          createFieldKey(field.name.peek()) === pathKey ||
          isDescendantFieldPath(field.name.peek(), path)
      )

      if (!stillUsed) {
        lifecycle.removeFieldValue(path)
      }
    }
  }

  /**
   * 判断被移除字段的值是否仍可安全删除。
   *
   * @param node - 即将从运行时树中移除的节点。
   * @returns 字段未被其他活动字段或后代字段复用时返回 `true`。
   */
  function shouldRemoveFieldValue(node: ContainerNode<TValues>): boolean {
    if (!isFieldNode(node) || node.staticSchema.peek().preserve !== false) {
      return false
    }

    const activeFields = nodeManager.values().filter(isFieldNode)

    const pathKey = createFieldKey(node.name.peek())

    return !activeFields.some(
      (field) =>
        createFieldKey(field.name.peek()) === pathKey ||
        isDescendantFieldPath(field.name.peek(), node.name.peek())
    )
  }

  /**
   * 将树结构恢复到协调前状态，并移除本轮已挂载节点。
   *
   * @param parent - 本轮发生协调的父节点。
   * @param previousChildren - 协调前的直接子节点顺序。
   * @param mountedNodes - 本轮已成功挂载的节点。
   */
  function rollbackTree(
    parent: ParentNode<TValues>,
    previousChildren: readonly SchemaNode<TValues>[]
  ): void {
    const previousIds = new Set(previousChildren.map((node) => node.id))

    const currentChildren = nodeManager.getChildren(parent.id)

    nodeManager.transaction(() => {
      for (const node of [...currentChildren].reverse()) {
        if (!previousIds.has(node.id) && nodeManager.has(node.id)) {
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
    refresh,
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
  children: readonly SchemaNode<TValues>[]
): Map<string, SchemaNode<TValues>> {
  const nodesByKey = new Map<string, SchemaNode<TValues>>()

  for (const child of children) {
    nodesByKey.set(child.key, child)
  }

  return nodesByKey
}

/**
 * 判断同一父节点的直接子节点顺序是否已经与目标一致。
 *
 * 原样重复提交时跳过逐节点 getIndex/move，避免在大规模 Schema 下产生无意义的
 * 线性扫描和 childNodes Signal 写入。
 */
function areNodeOrdersEqual<TValues extends Values>(
  previous: readonly SchemaNode<TValues>[],
  next: readonly SchemaNode<TValues>[]
): boolean {
  return (
    previous.length === next.length &&
    previous.every((node, index) => node === next[index])
  )
}

/**
 * 判断节点是否位于指定父节点的子树中。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的节点。
 * @param parent - 候选父节点。
 * @returns 节点自身或其祖先链包含 `parent` 时返回 `true`。
 */
function isNodeInSubtree<TValues extends Values>(
  node: ContainerNode<TValues>,
  parent: ParentNode<TValues>
): boolean {
  let current: ContainerNode<TValues> | null = node

  while (current) {
    if (current === parent) {
      return true
    }

    current = current.parent
  }

  return false
}
