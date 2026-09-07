/**
 * Node 树的索引、关系查询和结构操作实现。
 *
 * NodeManager 只维护树结构和节点索引，不负责节点资源的挂载与释放。
 *
 * @module core/runtime/node/nodeManager
 */

import { batch } from "@preact/signals-core"

import { createSignal } from "../../reactivity"

import { isParentNode, isRootNode } from "./helper"
import { createScope } from "./scope"

import type { ContainerNode, NodeId, ParentNode, RootNode, SchemaNode } from "./types"
import type { Values } from "../../types"

/**
 * Node 树的管理接口。
 *
 * NodeManager 维护节点索引、父子关系和 childNodes 顺序；节点资源的生命周期由
 * reconciler 和 NodeLifecycle 负责。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const manager = createNodeManager()
 * manager.append(node, manager.getRoot().id)
 * ```
 */
export interface NodeManager<TValues extends Values = Values> {
  /**
   * 包含 root 在内的节点总数。
   */
  readonly size: number

  // ---------------------------------------------------------------------------
  // 查询
  // ---------------------------------------------------------------------------

  /**
   * 获取透明 root 节点。
   *
   * @returns 当前树的 root 节点。
   */
  getRoot(): RootNode<TValues>

  /**
   * 按稳定 id 获取节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 匹配的节点；不存在时返回 `undefined`。
   */
  get(id: NodeId): ContainerNode<TValues> | undefined

  /**
   * 判断节点索引中是否存在指定 id。
   *
   * @param id - 要查询的节点 id。
   * @returns 节点存在时返回 `true`。
   */
  has(id: NodeId): boolean

  /**
   * 获取节点的直接父节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 父节点；root 返回 `null`，未知 id 返回 `undefined`。
   */
  getParent(id: NodeId): ParentNode<TValues> | null | undefined

  /**
   * 获取节点的直接子节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 子节点列表；未知节点或不可承载子节点的节点返回空数组。
   */
  getChildren(id: NodeId): readonly SchemaNode<TValues>[]

  /**
   * 获取同级节点，不包含自身。
   *
   * @param id - 要查询的节点 id。
   * @returns 同一父节点下的其他子节点。
   */
  getSiblings(id: NodeId): readonly SchemaNode<TValues>[]

  /**
   * 获取节点在当前 parent.childNodes 中的位置。
   *
   * root 或节点不存在时返回 undefined。
   *
   * @param id - 要查询的节点 id。
   * @returns 从 `0` 开始的子节点位置；不适用时返回 `undefined`。
   */
  getIndex(id: NodeId): number | undefined

  /**
   * 获取祖先节点。
   *
   * 顺序：
   * parent -> grandparent -> root
   *
   * @param id - 要查询的节点 id。
   * @returns 从直接父节点到 root 的祖先列表。
   */
  getAncestors(id: NodeId): readonly ParentNode<TValues>[]

  /**
   * 获取全部后代节点。
   *
   * 使用 preorder：
   * child -> descendant
   *
   * @param id - 要查询的节点 id。
   * @returns 按 preorder 排列的后代节点，不包含自身。
   */
  getDescendants(id: NodeId): readonly SchemaNode<TValues>[]

  // ---------------------------------------------------------------------------
  // 关系
  // ---------------------------------------------------------------------------

  /**
   * 判断一个节点是否为另一个节点的祖先。
   *
   * @param ancestorId - 候选祖先节点 id。
   * @param id - 要检查的后代节点 id。
   * @returns `ancestorId` 严格位于 `id` 的父链上时返回 `true`。
   */
  isAncestor(ancestorId: NodeId, id: NodeId): boolean

  /**
   * 判断一个节点是否为另一个节点的后代。
   *
   * @param id - 候选后代节点 id。
   * @param ancestorId - 要检查的祖先节点 id。
   * @returns `id` 严格位于 `ancestorId` 的子树中时返回 `true`。
   */
  isDescendant(id: NodeId, ancestorId: NodeId): boolean

  // ---------------------------------------------------------------------------
  // 插入
  // ---------------------------------------------------------------------------

  /**
   * 将 detached 节点及其子树插入指定父节点。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param parentId - 目标父节点 id。
   * @param index - 插入位置；省略时追加到末尾。
   * @throws 节点已挂载、父节点无效或节点 id 冲突时抛出错误。
   */
  insert(node: SchemaNode<TValues>, parentId: NodeId, index?: number): void

  /**
   * 将节点追加到指定父节点末尾。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param parentId - 目标父节点 id。
   */
  append(node: SchemaNode<TValues>, parentId: NodeId): void

  /**
   * 将节点插入指定父节点开头。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param parentId - 目标父节点 id。
   */
  prepend(node: SchemaNode<TValues>, parentId: NodeId): void

  /**
   * 将节点插入到参考节点之前。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param referenceId - 同级参考节点 id。
   */
  insertBefore(node: SchemaNode<TValues>, referenceId: NodeId): void

  /**
   * 将节点插入到参考节点之后。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param referenceId - 同级参考节点 id。
   */
  insertAfter(node: SchemaNode<TValues>, referenceId: NodeId): void

  // ---------------------------------------------------------------------------
  // 移动
  // ---------------------------------------------------------------------------

  /**
   * 将已挂载节点移动到目标父节点的指定位置。
   *
   * @param id - 要移动的节点 id。
   * @param parentId - 目标父节点 id。
   * @param index - 目标位置；省略时移动到末尾。
   * @throws 目标父节点位于节点自身子树中时抛出错误。
   */
  move(id: NodeId, parentId: NodeId, index?: number): void

  /**
   * 将节点移动到参考节点之前。
   *
   * @param id - 要移动的节点 id。
   * @param referenceId - 同级参考节点 id。
   */
  moveBefore(id: NodeId, referenceId: NodeId): void

  /**
   * 将节点移动到参考节点之后。
   *
   * @param id - 要移动的节点 id。
   * @param referenceId - 同级参考节点 id。
   */
  moveAfter(id: NodeId, referenceId: NodeId): void

  // ---------------------------------------------------------------------------
  // 删除
  // ---------------------------------------------------------------------------

  /**
   * 删除节点以及整个 subtree。
   *
   * 只解除树结构并返回 preorder 节点列表，不处理资源或 scope。
   *
   * @param id - 要删除的 SchemaNode id。
   */
  remove(id: NodeId): readonly ContainerNode<TValues>[]

  /**
   * 删除某个 parent 的全部 children。
   *
   * @param id - 要清空子节点的父节点 id。
   * @returns 被删除的节点列表。
   */
  removeChildren(id: NodeId): readonly ContainerNode<TValues>[]

  /**
   * 清空整棵树，但保留 root。
   *
   * @returns 被删除的 SchemaNode 列表。
   */
  clear(): readonly ContainerNode<TValues>[]

  /**
   * 在一个响应式批次内执行多次树结构操作。
   *
   * @param run - 要批量执行的树结构操作。
   */
  transaction(run: () => void): void

  /**
   * 一次性写入同一父节点的既有子节点顺序，不改变节点归属或节点状态。
   *
   * 仅用于 Reconciler 已完成 key 校验且 children 集合未变化的纯重排。
   */
  reorderChildren(parentId: NodeId, children: readonly SchemaNode<TValues>[]): void

  /**
   * 关闭节点索引并禁止后续写操作，不处理节点生命周期。
   */
  dispose(): void

  // ---------------------------------------------------------------------------
  // 数据
  // ---------------------------------------------------------------------------

  /**
   * @returns 所有节点。
   */
  values(): readonly ContainerNode<TValues>[]
}

/**
 * 创建空的 Node 树管理器。
 *
 * 创建结果包含一个 id 为 `0` 的透明 root 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 新的 NodeManager 实例。
 *
 * @example
 * ```ts
 * const manager = createNodeManager()
 * const root = manager.getRoot()
 * ```
 */
export function createNodeManager<
  TValues extends Values = Values,
>(): NodeManager<TValues> {
  // root 始终作为唯一保留的透明节点存在于索引中。
  const root: RootNode<TValues> = {
    id: 0,
    key: "schemx:root",
    type: "root",
    parent: null,
    scope: createScope(),
    disposed: createSignal(false),
    childNodes: createSignal([]),
    viewSchemas: null,
  }

  // 以稳定 id 索引整棵树，供查询和结构操作复用。
  const nodes = new Map<NodeId, ContainerNode<TValues>>()

  // dispose 后拒绝所有会写入树结构的操作。
  let disposed = false

  /**
   * 读取父节点当前的子节点列表。
   *
   * @param node - 要读取子节点的父节点。
   * @returns 当前子节点列表。
   */
  function readChildren(node: ParentNode<TValues>): readonly SchemaNode<TValues>[] {
    return node.childNodes.value
  }

  /**
   * 复制写入父节点的子节点列表，触发 childNodes 的响应式更新。
   *
   * @param node - 要更新子节点的父节点。
   * @param children - 新的子节点顺序。
   */
  function writeChildren(
    node: ParentNode<TValues>,
    children: readonly SchemaNode<TValues>[]
  ): void {
    node.childNodes.value = [...children]
  }

  /**
   * 确认 NodeManager 仍可执行写操作。
   *
   * @throws 管理器已经释放时抛出错误。
   */
  function assertManagerAvailable(): void {
    if (disposed) {
      throw new Error("[schemx] NodeManager has already been disposed.")
    }
  }

  /**
   * 从索引读取节点，并将未知 id 转换为统一异常。
   *
   * @param id - 要读取的节点 id。
   * @returns 索引中的 Node。
   * @throws 节点不存在时抛出错误。
   */
  function requireNode(id: NodeId): ContainerNode<TValues> {
    const node = nodes.get(id)

    if (!node) {
      throw new Error(`[schemx] Node "${id}" does not exist`)
    }

    return node
  }

  /**
   * 获取非 root 的 SchemaNode。
   *
   * @param id - 要读取的节点 id。
   * @returns 索引中的 SchemaNode。
   * @throws 节点不存在或为 root 时抛出错误。
   */
  function requireSchemaNode(id: NodeId): SchemaNode<TValues> {
    const node = requireNode(id)

    if (isRootNode(node)) {
      throw new Error("[schemx] RootNode cannot be used as a schema node")
    }

    return node
  }

  /**
   * 获取可以承载子节点的 Node。
   *
   * @param id - 要读取的节点 id。
   * @returns 索引中的 ParentNode。
   * @throws 节点不存在或不能承载子节点时抛出错误。
   */
  function requireParentNode(id: NodeId): ParentNode<TValues> {
    const node = requireNode(id)

    if (!isParentNode(node)) {
      throw new Error(`[schemx] Node "${id}" cannot contain children`)
    }

    return node
  }

  /**
   * 校验并归一化插入位置；省略位置表示追加到末尾。
   *
   * @param index - 调用方提供的目标位置。
   * @param max - 当前允许的最大位置。
   * @returns 可用于数组操作的合法位置。
   * @throws 位置不是非负整数或超出范围时抛出 `RangeError`。
   */
  function normalizeIndex(index: number | undefined, max: number): number {
    if (index == null) {
      return max
    }

    if (!Number.isInteger(index) || index < 0 || index > max) {
      throw new RangeError(`[schemx] Invalid child index "${index}"`)
    }

    return index
  }

  /**
   * 查找节点在父节点 childNodes 中的当前位置。
   *
   * @param parent - 要查询的父节点。
   * @param id - 要查询的子节点 id。
   * @returns 子节点位置；未找到时返回 `-1`。
   */
  function childIndex(parent: ParentNode<TValues>, id: NodeId): number {
    return readChildren(parent).findIndex((child) => child.id === id)
  }

  /**
   * 以 preorder 收集节点及其后代，并在发现环或重复节点时失败。
   *
   * @param node - 要收集的子树根节点。
   * @returns 按 preorder 排列的子树节点列表。
   * @throws 发现环或重复节点引用时抛出错误。
   */
  function collectSubtree(node: ContainerNode<TValues>): ContainerNode<TValues>[] {
    const result: ContainerNode<TValues>[] = []

    const stack: ContainerNode<TValues>[] = [node]

    const visited = new Set<ContainerNode<TValues>>()

    while (stack.length > 0) {
      const current = stack.pop()

      if (!current) {
        continue
      }

      if (visited.has(current)) {
        throw new Error(
          `[schemx] Circular or duplicated runtime node detected: ${current.id}`
        )
      }

      visited.add(current)

      result.push(current)

      if (!isParentNode(current)) {
        continue
      }

      const children = readChildren(current)

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]

        if (child) {
          stack.push(child)
        }
      }
    }

    return result
  }

  /**
   * 为插入或移动后的整棵子树同步绑定父节点引用。
   *
   * @param node - 要绑定的子树根节点。
   * @param parent - 子树根节点的新父节点。
   */
  function bindSubtreeParent(
    node: SchemaNode<TValues>,
    parent: ParentNode<TValues>
  ): void {
    node.parent = parent

    if (!isParentNode(node)) {
      return
    }

    for (const child of readChildren(node)) {
      bindSubtreeParent(child, node)
    }
  }

  /**
   * 在确认整棵子树的 id 都可用后一次性加入索引。
   *
   * @param node - 要注册的子树根节点。
   * @throws 子树内部或全局索引存在重复 id 时抛出错误。
   */
  function registerSubtree(node: SchemaNode<TValues>): void {
    const subtree = collectSubtree(node)

    const localIds = new Set<NodeId>()

    for (const current of subtree) {
      if (localIds.has(current.id)) {
        throw new Error(`[schemx] Duplicate Node id "${current.id}" inside subtree`)
      }

      if (nodes.has(current.id)) {
        throw new Error(`[schemx] Node "${current.id}" already exists`)
      }

      localIds.add(current.id)
    }

    for (const current of subtree) {
      nodes.set(current.id, current)
    }
  }

  /**
   * 从索引移除已脱离树结构的整棵子树。
   *
   * @param subtree - 要移除的节点列表。
   */
  function unregisterNodes(subtree: readonly ContainerNode<TValues>[]): void {
    for (const current of subtree) {
      nodes.delete(current.id)
    }
  }

  // ---------------------------------------------------------------------------
  // 基础查询
  // ---------------------------------------------------------------------------

  function get(id: NodeId): ContainerNode<TValues> | undefined {
    return nodes.get(id)
  }

  function has(id: NodeId): boolean {
    return nodes.has(id)
  }

  function getRoot(): RootNode<TValues> {
    return root
  }

  // ---------------------------------------------------------------------------
  // 关系查询
  // ---------------------------------------------------------------------------

  function getParent(id: NodeId): ParentNode<TValues> | null | undefined {
    return nodes.get(id)?.parent
  }

  function getChildren(id: NodeId): readonly SchemaNode<TValues>[] {
    const node = nodes.get(id)

    if (!node || !isParentNode(node)) {
      return []
    }

    return readChildren(node)
  }

  function getSiblings(id: NodeId): readonly SchemaNode<TValues>[] {
    const node = nodes.get(id)

    if (!node?.parent) {
      return []
    }

    return readChildren(node.parent).filter((sibling) => sibling.id !== id)
  }

  function getIndex(id: NodeId): number | undefined {
    const node = nodes.get(id)

    if (!node?.parent) {
      return undefined
    }

    const index = childIndex(node.parent, id)

    return index >= 0 ? index : undefined
  }

  function getAncestors(id: NodeId): readonly ParentNode<TValues>[] {
    const node = nodes.get(id)

    if (!node) {
      return []
    }

    const result: ParentNode<TValues>[] = []

    let parent = node.parent

    const visited = new Set<NodeId>()

    while (parent) {
      if (visited.has(parent.id)) {
        throw new Error(
          `[schemx] Circular parent relationship detected at runtime node ${parent.id}`
        )
      }

      visited.add(parent.id)
      result.push(parent)
      parent = parent.parent
    }

    return result
  }

  function getDescendants(id: NodeId): readonly SchemaNode<TValues>[] {
    const node = nodes.get(id)

    if (!node || !isParentNode(node)) {
      return []
    }

    const result: SchemaNode<TValues>[] = []

    const stack = [...readChildren(node)].reverse()

    const visited = new Set<ContainerNode<TValues>>()

    while (stack.length > 0) {
      const current = stack.pop()

      if (!current) {
        continue
      }

      if (visited.has(current)) {
        throw new Error(
          `[schemx] Circular or duplicated runtime node detected: ${current.id}`
        )
      }

      visited.add(current)

      result.push(current)

      if (!isParentNode(current)) {
        continue
      }

      const children = readChildren(current)

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]

        if (child) {
          stack.push(child)
        }
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // 关系判断
  // ---------------------------------------------------------------------------

  function isAncestor(ancestorId: NodeId, id: NodeId): boolean {
    if (ancestorId === id) {
      return false
    }

    let current = nodes.get(id)?.parent

    const visited = new Set<NodeId>()

    while (current) {
      if (visited.has(current.id)) {
        throw new Error(
          `[schemx] Circular parent relationship detected at runtime node ${current.id}`
        )
      }

      visited.add(current.id)

      if (current.id === ancestorId) {
        return true
      }

      current = current.parent
    }

    return false
  }

  function isDescendant(id: NodeId, ancestorId: NodeId): boolean {
    return isAncestor(ancestorId, id)
  }

  // ---------------------------------------------------------------------------
  // 插入
  // ---------------------------------------------------------------------------

  // 插入会同时更新父子列表、子树 parent 引用和节点索引。
  function insert(node: SchemaNode<TValues>, parentId: NodeId, index?: number): void {
    assertManagerAvailable()

    const parent = requireParentNode(parentId)

    if (node.parent) {
      throw new Error(`[schemx] Node "${node.id}" is already attached`)
    }

    const children = [...readChildren(parent)]

    const targetIndex = normalizeIndex(index, children.length)

    registerSubtree(node)

    batch(() => {
      bindSubtreeParent(node, parent)

      children.splice(targetIndex, 0, node)

      writeChildren(parent, children)
    })
  }

  function append(node: SchemaNode<TValues>, parentId: NodeId): void {
    insert(node, parentId)
  }

  function prepend(node: SchemaNode<TValues>, parentId: NodeId): void {
    insert(node, parentId, 0)
  }

  function insertBefore(node: SchemaNode<TValues>, referenceId: NodeId): void {
    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] Node "${referenceId}" has no parent`)
    }

    const index = childIndex(parent, referenceId)

    if (index < 0) {
      throw new Error(`[schemx] Node "${referenceId}" is not attached`)
    }

    insert(node, parent.id, index)
  }

  function insertAfter(node: SchemaNode<TValues>, referenceId: NodeId): void {
    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] Node "${referenceId}" has no parent`)
    }

    const index = childIndex(parent, referenceId)

    if (index < 0) {
      throw new Error(`[schemx] Node "${referenceId}" is not attached`)
    }

    insert(node, parent.id, index + 1)
  }

  // ---------------------------------------------------------------------------
  // 移动
  // ---------------------------------------------------------------------------

  // 移动同父节点时只调整顺序，跨父节点时同时更新两侧 childNodes。
  function move(id: NodeId, parentId: NodeId, index?: number): void {
    assertManagerAvailable()

    const node = requireSchemaNode(id)

    const targetParent = requireParentNode(parentId)

    const sourceParent = node.parent

    if (!sourceParent) {
      throw new Error(`[schemx] Node "${id}" is detached`)
    }

    if (id === parentId || isAncestor(id, parentId)) {
      throw new Error(`[schemx] Cannot move Node "${id}" into itself or its descendant`)
    }

    const sourceChildren = [...readChildren(sourceParent)]

    const sourceIndex = sourceChildren.findIndex((child) => child.id === id)

    if (sourceIndex < 0) {
      throw new Error(`[schemx] Node "${id}" is not attached`)
    }

    if (sourceParent.id === targetParent.id) {
      const targetIndex = normalizeIndex(index, sourceChildren.length - 1)

      if (targetIndex === sourceIndex) {
        return
      }

      sourceChildren.splice(sourceIndex, 1)
      sourceChildren.splice(targetIndex, 0, node)

      writeChildren(sourceParent, sourceChildren)

      return
    }

    const targetChildren = [...readChildren(targetParent)]

    const targetIndex = normalizeIndex(index, targetChildren.length)

    sourceChildren.splice(sourceIndex, 1)
    targetChildren.splice(targetIndex, 0, node)

    batch(() => {
      node.parent = targetParent

      writeChildren(sourceParent, sourceChildren)
      writeChildren(targetParent, targetChildren)
    })
  }

  function moveBefore(id: NodeId, referenceId: NodeId): void {
    if (id === referenceId) {
      return
    }

    const node = requireSchemaNode(id)

    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] Node "${referenceId}" has no parent`)
    }

    const referenceIndex = childIndex(parent, referenceId)

    let targetIndex = referenceIndex

    if (node.parent?.id === parent.id) {
      const sourceIndex = childIndex(parent, id)

      if (sourceIndex < referenceIndex) {
        targetIndex--
      }
    }

    move(id, parent.id, targetIndex)
  }

  function moveAfter(id: NodeId, referenceId: NodeId): void {
    if (id === referenceId) {
      return
    }

    const node = requireSchemaNode(id)

    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] Node "${referenceId}" has no parent`)
    }

    const referenceIndex = childIndex(parent, referenceId)

    let targetIndex = referenceIndex + 1

    if (node.parent?.id === parent.id) {
      const sourceIndex = childIndex(parent, id)

      if (sourceIndex < referenceIndex) {
        targetIndex--
      }
    }

    move(id, parent.id, targetIndex)
  }

  // ---------------------------------------------------------------------------
  // 删除
  // ---------------------------------------------------------------------------

  // 删除先解除树结构，再返回节点供 reconciler 负责资源清理。
  function remove(id: NodeId): readonly ContainerNode<TValues>[] {
    assertManagerAvailable()

    const node = requireSchemaNode(id)

    const parent = node.parent

    if (!parent) {
      throw new Error(`[schemx] Node "${id}" is detached`)
    }

    const children = [...readChildren(parent)]

    const index = childIndex(parent, id)

    if (index < 0) {
      throw new Error(`[schemx] Node "${id}" is not attached`)
    }

    children.splice(index, 1)

    const removed = collectSubtree(node)

    batch(() => {
      writeChildren(parent, children)

      for (const current of removed) {
        if (isParentNode(current)) {
          writeChildren(current, [])
        }

        current.parent = null
      }
    })

    unregisterNodes(removed)

    return removed
  }

  function removeChildren(id: NodeId): readonly ContainerNode<TValues>[] {
    assertManagerAvailable()

    const parent = requireParentNode(id)

    const children = [...readChildren(parent)]

    if (children.length === 0) {
      return []
    }

    const removed: ContainerNode<TValues>[] = []

    for (const child of children) {
      removed.push(...remove(child.id))
    }

    return removed
  }

  function clear(): readonly ContainerNode<TValues>[] {
    return removeChildren(root.id)
  }

  function transaction(run: () => void): void {
    assertManagerAvailable()
    batch(run)
  }

  function reorderChildren(
    parentId: NodeId,
    children: readonly SchemaNode<TValues>[]
  ): void {
    assertManagerAvailable()

    const parent = requireParentNode(parentId)

    const currentChildren = readChildren(parent)

    const currentIds = new Set(currentChildren.map((child) => child.id))

    const childIds = new Set<NodeId>()

    if (
      currentChildren.length !== children.length ||
      children.some((child) => {
        if (
          child.parent?.id !== parentId ||
          !currentIds.has(child.id) ||
          childIds.has(child.id)
        ) {
          return true
        }

        childIds.add(child.id)

        return false
      })
    ) {
      throw new Error(
        `[schemx] Cannot reorder children for Node "${parentId}" with a different child set.`
      )
    }

    writeChildren(parent, children)
  }

  // dispose 只关闭结构管理器，不替代 NodeLifecycle 的资源释放。
  function dispose(): void {
    if (disposed) {
      return
    }

    nodes.clear()
    disposed = true
  }

  function values(): ContainerNode<TValues>[] {
    return [...nodes.values()]
  }

  // ---------------------------------------------------------------------------
  // 初始化
  // ---------------------------------------------------------------------------

  root.parent = null
  nodes.set(root.id, root)

  for (const child of readChildren(root)) {
    bindSubtreeParent(child, root)
    registerSubtree(child)
  }

  return {
    // 基础查询
    get,
    has,
    getRoot,

    // 关系查询
    getParent,
    getChildren,
    getSiblings,
    getIndex,
    getAncestors,
    getDescendants,

    // 关系判断
    isAncestor,
    isDescendant,

    // 插入
    insert,
    append,
    prepend,
    insertBefore,
    insertAfter,

    // 移动
    move,
    moveBefore,
    moveAfter,

    // 删除
    remove,
    removeChildren,
    clear,
    transaction,
    reorderChildren,
    dispose,

    // 数据
    values,

    // 状态
    get size() {
      return nodes.size
    },
  }
}
