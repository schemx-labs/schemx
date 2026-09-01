/**
 * RuntimeNode 树的索引、关系查询和结构操作实现。
 *
 * NodeManager 只维护树结构和节点索引，不负责节点资源的挂载与释放。
 *
 * @module core/runtime/node/nodeManager
 */

import { batch } from "@preact/signals-core"

import { createSignal } from "../../reactivity"

import { createRuntimeScope } from "./runtimeScope"

import type {
  ParentRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeId,
  SchemaRuntimeNode,
} from "./types"
import type { Values } from "../../types"

/**
 * NodeManager 遍历节点时调用的回调。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 当前访问的 RuntimeNode。
 * @param depth - 当前节点相对于遍历起点的深度。
 */
export type NodeTreeVisitor<TValues extends Values = Values> = (
  node: RuntimeNode<TValues>,
  depth: number
) => void

/**
 * NodeManager 查找节点时使用的谓词。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 当前待判断的 RuntimeNode。
 * @returns 是否命中当前节点。
 */
export type NodeTreePredicate<TValues extends Values = Values> = (
  node: RuntimeNode<TValues>
) => boolean

/**
 * RuntimeNode 树的管理接口。
 *
 * NodeManager 维护节点索引、父子关系和 childNodes 顺序；节点资源的生命周期由
 * reconciler 和 RuntimeNodeLifecycle 负责。
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
  getRoot(): RootRuntimeNode<TValues>

  /**
   * 按稳定 id 获取节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 匹配的节点；不存在时返回 `undefined`。
   */
  get(id: RuntimeNodeId): RuntimeNode<TValues> | undefined

  /**
   * 判断节点索引中是否存在指定 id。
   *
   * @param id - 要查询的节点 id。
   * @returns 节点存在时返回 `true`。
   */
  has(id: RuntimeNodeId): boolean

  /**
   * 获取节点的直接父节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 父节点；root 返回 `null`，未知 id 返回 `undefined`。
   */
  getParent(id: RuntimeNodeId): ParentRuntimeNode<TValues> | null | undefined

  /**
   * 获取节点的直接子节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 子节点列表；未知节点或不可承载子节点的节点返回空数组。
   */
  getChildren(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[]

  /**
   * 获取同级节点，不包含自身。
   *
   * @param id - 要查询的节点 id。
   * @returns 同一父节点下的其他子节点。
   */
  getSiblings(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[]

  /**
   * 获取节点在当前 parent.childNodes 中的位置。
   *
   * root 或节点不存在时返回 undefined。
   *
   * @param id - 要查询的节点 id。
   * @returns 从 `0` 开始的子节点位置；不适用时返回 `undefined`。
   */
  getIndex(id: RuntimeNodeId): number | undefined

  /**
   * 获取祖先节点。
   *
   * 顺序：
   * parent -> grandparent -> root
   *
   * @param id - 要查询的节点 id。
   * @returns 从直接父节点到 root 的祖先列表。
   */
  getAncestors(id: RuntimeNodeId): readonly ParentRuntimeNode<TValues>[]

  /**
   * 获取全部后代节点。
   *
   * 使用 preorder：
   * child -> descendant
   *
   * @param id - 要查询的节点 id。
   * @returns 按 preorder 排列的后代节点，不包含自身。
   */
  getDescendants(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[]

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
  isAncestor(ancestorId: RuntimeNodeId, id: RuntimeNodeId): boolean

  /**
   * 判断一个节点是否为另一个节点的后代。
   *
   * @param id - 候选后代节点 id。
   * @param ancestorId - 要检查的祖先节点 id。
   * @returns `id` 严格位于 `ancestorId` 的子树中时返回 `true`。
   */
  isDescendant(id: RuntimeNodeId, ancestorId: RuntimeNodeId): boolean

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
  insert(node: SchemaRuntimeNode<TValues>, parentId: RuntimeNodeId, index?: number): void

  /**
   * 将节点追加到指定父节点末尾。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param parentId - 目标父节点 id。
   */
  append(node: SchemaRuntimeNode<TValues>, parentId: RuntimeNodeId): void

  /**
   * 将节点插入指定父节点开头。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param parentId - 目标父节点 id。
   */
  prepend(node: SchemaRuntimeNode<TValues>, parentId: RuntimeNodeId): void

  /**
   * 将节点插入到参考节点之前。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param referenceId - 同级参考节点 id。
   */
  insertBefore(node: SchemaRuntimeNode<TValues>, referenceId: RuntimeNodeId): void

  /**
   * 将节点插入到参考节点之后。
   *
   * @param node - 要插入且尚未挂载的节点。
   * @param referenceId - 同级参考节点 id。
   */
  insertAfter(node: SchemaRuntimeNode<TValues>, referenceId: RuntimeNodeId): void

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
  move(id: RuntimeNodeId, parentId: RuntimeNodeId, index?: number): void

  /**
   * 将节点移动到参考节点之前。
   *
   * @param id - 要移动的节点 id。
   * @param referenceId - 同级参考节点 id。
   */
  moveBefore(id: RuntimeNodeId, referenceId: RuntimeNodeId): void

  /**
   * 将节点移动到参考节点之后。
   *
   * @param id - 要移动的节点 id。
   * @param referenceId - 同级参考节点 id。
   */
  moveAfter(id: RuntimeNodeId, referenceId: RuntimeNodeId): void

  // ---------------------------------------------------------------------------
  // 删除
  // ---------------------------------------------------------------------------

  /**
   * 删除节点以及整个 subtree。
   *
   * 只解除树结构并返回 preorder 节点列表，不处理资源或 scope。
   *
   * @param id - 要删除的 SchemaRuntimeNode id。
   */
  remove(id: RuntimeNodeId): readonly RuntimeNode<TValues>[]

  /**
   * 删除某个 parent 的全部 children。
   *
   * @param id - 要清空子节点的父节点 id。
   * @returns 被删除的节点列表。
   */
  removeChildren(id: RuntimeNodeId): readonly RuntimeNode<TValues>[]

  /**
   * 清空整棵树，但保留 root。
   *
   * @returns 被删除的 SchemaRuntimeNode 列表。
   */
  clear(): readonly RuntimeNode<TValues>[]

  /**
   * 在一个响应式批次内执行多次树结构操作。
   *
   * @param run - 要批量执行的树结构操作。
   */
  transaction(run: () => void): void

  /**
   * 关闭节点索引并禁止后续写操作，不处理节点生命周期。
   */
  dispose(): void

  // ---------------------------------------------------------------------------
  // 遍历 / 查找
  // ---------------------------------------------------------------------------

  /**
   * 从指定节点开始 preorder 遍历，包含自身。
   *
   * @param id - 遍历起点节点 id。
   * @param visitor - 每访问一个节点时调用的回调。
   */
  traverse(id: RuntimeNodeId, visitor: NodeTreeVisitor<TValues>): void

  /**
   * preorder 查找第一个节点。
   *
   * 包含 root。
   *
   * @param predicate - 判断节点是否命中的谓词。
   * @returns 首个命中的节点；没有命中时返回 `undefined`。
   */
  find(predicate: NodeTreePredicate<TValues>): RuntimeNode<TValues> | undefined

  /**
   * preorder 查找所有节点。
   *
   * 包含 root。
   *
   * @param predicate - 判断节点是否命中的谓词。
   * @returns 所有命中的节点，顺序与 preorder 遍历一致。
   */
  filter(predicate: NodeTreePredicate<TValues>): readonly RuntimeNode<TValues>[]
}

/**
 * 创建空的 RuntimeNode 树管理器。
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
  const root: RootRuntimeNode<TValues> = {
    id: 0,
    key: "schemx:root",
    type: "root",
    parent: null,
    scope: createRuntimeScope(),
    disposed: createSignal(false),
    childNodes: createSignal([]),
    viewSchemas: null,
  }

  // 以稳定 id 索引整棵树，供查询和结构操作复用。
  const nodes = new Map<RuntimeNodeId, RuntimeNode<TValues>>()

  // dispose 后拒绝所有会写入树结构的操作。
  let disposed = false

  /**
   * 判断节点是否可以承载 childNodes。
   *
   * @param node - 要判断的 RuntimeNode。
   * @returns Root、Group 或 Dependency 节点时返回 `true`。
   */
  function isParentNode(node: RuntimeNode<TValues>): node is ParentRuntimeNode<TValues> {
    return node.type === "root" || node.type === "group" || node.type === "dependency"
  }

  /**
   * 读取父节点当前的子节点列表。
   *
   * @param node - 要读取子节点的父节点。
   * @returns 当前子节点列表。
   */
  function readChildren(
    node: ParentRuntimeNode<TValues>
  ): readonly SchemaRuntimeNode<TValues>[] {
    return node.childNodes.value
  }

  /**
   * 复制写入父节点的子节点列表，触发 childNodes 的响应式更新。
   *
   * @param node - 要更新子节点的父节点。
   * @param children - 新的子节点顺序。
   */
  function writeChildren(
    node: ParentRuntimeNode<TValues>,
    children: readonly SchemaRuntimeNode<TValues>[]
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
   * @returns 索引中的 RuntimeNode。
   * @throws 节点不存在时抛出错误。
   */
  function requireNode(id: RuntimeNodeId): RuntimeNode<TValues> {
    const node = nodes.get(id)

    if (!node) {
      throw new Error(`[schemx] RuntimeNode "${id}" does not exist`)
    }

    return node
  }

  /**
   * 获取非 root 的 SchemaRuntimeNode。
   *
   * @param id - 要读取的节点 id。
   * @returns 索引中的 SchemaRuntimeNode。
   * @throws 节点不存在或为 root 时抛出错误。
   */
  function requireSchemaNode(id: RuntimeNodeId): SchemaRuntimeNode<TValues> {
    const node = requireNode(id)

    if (node.type === "root") {
      throw new Error("[schemx] RootRuntimeNode cannot be used as a schema node")
    }

    return node
  }

  /**
   * 获取可以承载子节点的 RuntimeNode。
   *
   * @param id - 要读取的节点 id。
   * @returns 索引中的 ParentRuntimeNode。
   * @throws 节点不存在或不能承载子节点时抛出错误。
   */
  function requireParentNode(id: RuntimeNodeId): ParentRuntimeNode<TValues> {
    const node = requireNode(id)

    if (!isParentNode(node)) {
      throw new Error(`[schemx] RuntimeNode "${id}" cannot contain children`)
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
  function childIndex(parent: ParentRuntimeNode<TValues>, id: RuntimeNodeId): number {
    return readChildren(parent).findIndex((child) => child.id === id)
  }

  /**
   * 以 preorder 收集节点及其后代，并在发现环或重复节点时失败。
   *
   * @param node - 要收集的子树根节点。
   * @returns 按 preorder 排列的子树节点列表。
   * @throws 发现环或重复节点引用时抛出错误。
   */
  function collectSubtree(node: RuntimeNode<TValues>): RuntimeNode<TValues>[] {
    const result: RuntimeNode<TValues>[] = []

    const stack: RuntimeNode<TValues>[] = [node]

    const visited = new Set<RuntimeNode<TValues>>()

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
    node: SchemaRuntimeNode<TValues>,
    parent: ParentRuntimeNode<TValues>
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
  function registerSubtree(node: SchemaRuntimeNode<TValues>): void {
    const subtree = collectSubtree(node)

    const localIds = new Set<RuntimeNodeId>()

    for (const current of subtree) {
      if (localIds.has(current.id)) {
        throw new Error(
          `[schemx] Duplicate RuntimeNode id "${current.id}" inside subtree`
        )
      }

      if (nodes.has(current.id)) {
        throw new Error(`[schemx] RuntimeNode "${current.id}" already exists`)
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
  function unregisterNodes(subtree: readonly RuntimeNode<TValues>[]): void {
    for (const current of subtree) {
      nodes.delete(current.id)
    }
  }

  // ---------------------------------------------------------------------------
  // 基础查询
  // ---------------------------------------------------------------------------

  function get(id: RuntimeNodeId): RuntimeNode<TValues> | undefined {
    return nodes.get(id)
  }

  function has(id: RuntimeNodeId): boolean {
    return nodes.has(id)
  }

  function getRoot(): RootRuntimeNode<TValues> {
    return root
  }

  // ---------------------------------------------------------------------------
  // 关系查询
  // ---------------------------------------------------------------------------

  function getParent(id: RuntimeNodeId): ParentRuntimeNode<TValues> | null | undefined {
    return nodes.get(id)?.parent
  }

  function getChildren(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[] {
    const node = nodes.get(id)

    if (!node || !isParentNode(node)) {
      return []
    }

    return readChildren(node)
  }

  function getSiblings(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[] {
    const node = nodes.get(id)

    if (!node?.parent) {
      return []
    }

    return readChildren(node.parent).filter((sibling) => sibling.id !== id)
  }

  function getIndex(id: RuntimeNodeId): number | undefined {
    const node = nodes.get(id)

    if (!node?.parent) {
      return undefined
    }

    const index = childIndex(node.parent, id)

    return index >= 0 ? index : undefined
  }

  function getAncestors(id: RuntimeNodeId): readonly ParentRuntimeNode<TValues>[] {
    const node = nodes.get(id)

    if (!node) {
      return []
    }

    const result: ParentRuntimeNode<TValues>[] = []

    let parent = node.parent

    const visited = new Set<RuntimeNodeId>()

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

  function getDescendants(id: RuntimeNodeId): readonly SchemaRuntimeNode<TValues>[] {
    const node = nodes.get(id)

    if (!node || !isParentNode(node)) {
      return []
    }

    const result: SchemaRuntimeNode<TValues>[] = []

    const stack = [...readChildren(node)].reverse()

    const visited = new Set<RuntimeNode<TValues>>()

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

  function isAncestor(ancestorId: RuntimeNodeId, id: RuntimeNodeId): boolean {
    if (ancestorId === id) {
      return false
    }

    let current = nodes.get(id)?.parent

    const visited = new Set<RuntimeNodeId>()

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

  function isDescendant(id: RuntimeNodeId, ancestorId: RuntimeNodeId): boolean {
    return isAncestor(ancestorId, id)
  }

  // ---------------------------------------------------------------------------
  // 插入
  // ---------------------------------------------------------------------------

  // 插入会同时更新父子列表、子树 parent 引用和节点索引。
  function insert(
    node: SchemaRuntimeNode<TValues>,
    parentId: RuntimeNodeId,
    index?: number
  ): void {
    assertManagerAvailable()

    const parent = requireParentNode(parentId)

    if (node.parent) {
      throw new Error(`[schemx] RuntimeNode "${node.id}" is already attached`)
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

  function append(node: SchemaRuntimeNode<TValues>, parentId: RuntimeNodeId): void {
    insert(node, parentId)
  }

  function prepend(node: SchemaRuntimeNode<TValues>, parentId: RuntimeNodeId): void {
    insert(node, parentId, 0)
  }

  function insertBefore(
    node: SchemaRuntimeNode<TValues>,
    referenceId: RuntimeNodeId
  ): void {
    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" has no parent`)
    }

    const index = childIndex(parent, referenceId)

    if (index < 0) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" is not attached`)
    }

    insert(node, parent.id, index)
  }

  function insertAfter(
    node: SchemaRuntimeNode<TValues>,
    referenceId: RuntimeNodeId
  ): void {
    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" has no parent`)
    }

    const index = childIndex(parent, referenceId)

    if (index < 0) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" is not attached`)
    }

    insert(node, parent.id, index + 1)
  }

  // ---------------------------------------------------------------------------
  // 移动
  // ---------------------------------------------------------------------------

  // 移动同父节点时只调整顺序，跨父节点时同时更新两侧 childNodes。
  function move(id: RuntimeNodeId, parentId: RuntimeNodeId, index?: number): void {
    assertManagerAvailable()

    const node = requireSchemaNode(id)

    const targetParent = requireParentNode(parentId)

    const sourceParent = node.parent

    if (!sourceParent) {
      throw new Error(`[schemx] RuntimeNode "${id}" is detached`)
    }

    if (id === parentId || isAncestor(id, parentId)) {
      throw new Error(
        `[schemx] Cannot move RuntimeNode "${id}" into itself or its descendant`
      )
    }

    const sourceChildren = [...readChildren(sourceParent)]

    const sourceIndex = sourceChildren.findIndex((child) => child.id === id)

    if (sourceIndex < 0) {
      throw new Error(`[schemx] RuntimeNode "${id}" is not attached`)
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

  function moveBefore(id: RuntimeNodeId, referenceId: RuntimeNodeId): void {
    if (id === referenceId) {
      return
    }

    const node = requireSchemaNode(id)

    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" has no parent`)
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

  function moveAfter(id: RuntimeNodeId, referenceId: RuntimeNodeId): void {
    if (id === referenceId) {
      return
    }

    const node = requireSchemaNode(id)

    const reference = requireSchemaNode(referenceId)

    const parent = reference.parent

    if (!parent) {
      throw new Error(`[schemx] RuntimeNode "${referenceId}" has no parent`)
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
  function remove(id: RuntimeNodeId): readonly RuntimeNode<TValues>[] {
    assertManagerAvailable()

    const node = requireSchemaNode(id)

    const parent = node.parent

    if (!parent) {
      throw new Error(`[schemx] RuntimeNode "${id}" is detached`)
    }

    const children = [...readChildren(parent)]

    const index = childIndex(parent, id)

    if (index < 0) {
      throw new Error(`[schemx] RuntimeNode "${id}" is not attached`)
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

  function removeChildren(id: RuntimeNodeId): readonly RuntimeNode<TValues>[] {
    assertManagerAvailable()

    const parent = requireParentNode(id)

    const children = [...readChildren(parent)]

    if (children.length === 0) {
      return []
    }

    const removed: RuntimeNode<TValues>[] = []

    for (const child of children) {
      removed.push(...remove(child.id))
    }

    return removed
  }

  function clear(): readonly RuntimeNode<TValues>[] {
    return removeChildren(root.id)
  }

  function transaction(run: () => void): void {
    assertManagerAvailable()
    batch(run)
  }

  // dispose 只关闭结构管理器，不替代 RuntimeNodeLifecycle 的资源释放。
  function dispose(): void {
    if (disposed) {
      return
    }

    nodes.clear()
    disposed = true
  }

  // ---------------------------------------------------------------------------
  // 遍历 / 查找
  // ---------------------------------------------------------------------------

  // 使用递归 preorder 遍历，并通过 visited 检测环或重复引用。
  function traverse(id: RuntimeNodeId, visitor: NodeTreeVisitor<TValues>): void {
    const start = nodes.get(id)

    if (!start) {
      return
    }

    const visited = new Set<RuntimeNode<TValues>>()

    const walk = (node: RuntimeNode<TValues>, depth: number): void => {
      if (visited.has(node)) {
        throw new Error(
          `[schemx] Circular or duplicated runtime node detected: ${node.id}`
        )
      }

      visited.add(node)
      visitor(node, depth)

      if (!isParentNode(node)) {
        return
      }

      for (const child of readChildren(node)) {
        walk(child, depth + 1)
      }
    }

    walk(start, 0)
  }

  function find(predicate: NodeTreePredicate<TValues>): RuntimeNode<TValues> | undefined {
    if (!nodes.has(root.id)) {
      return undefined
    }

    const stack: RuntimeNode<TValues>[] = [root]

    const visited = new Set<RuntimeNode<TValues>>()

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node) {
        continue
      }

      if (visited.has(node)) {
        throw new Error(
          `[schemx] Circular or duplicated runtime node detected: ${node.id}`
        )
      }

      visited.add(node)

      if (predicate(node)) {
        return node
      }

      if (!isParentNode(node)) {
        continue
      }

      const children = readChildren(node)

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]

        if (child) {
          stack.push(child)
        }
      }
    }

    return undefined
  }

  function filter(
    predicate: NodeTreePredicate<TValues>
  ): readonly RuntimeNode<TValues>[] {
    if (!nodes.has(root.id)) {
      return []
    }

    const result: RuntimeNode<TValues>[] = []

    const stack: RuntimeNode<TValues>[] = [root]

    const visited = new Set<RuntimeNode<TValues>>()

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node) {
        continue
      }

      if (visited.has(node)) {
        throw new Error(
          `[schemx] Circular or duplicated runtime node detected: ${node.id}`
        )
      }

      visited.add(node)

      if (predicate(node)) {
        result.push(node)
      }

      if (!isParentNode(node)) {
        continue
      }

      const children = readChildren(node)

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
    dispose,

    // 遍历 / 查找
    traverse,
    find,
    filter,

    // 状态
    get size() {
      return nodes.size
    },
  }
}
