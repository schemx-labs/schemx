/**
 * Node 树的索引、关系查询和结构操作实现。
 *
 * NodeManager 维护树结构、路径索引和数组行归属，不负责节点资源的挂载与释放。
 *
 * @module core/node/nodeManager
 */

import { batch } from "@preact/signals-core"

import { createSignal } from "../reactivity"
import { createFieldKey } from "../utils/path"

import {
  createScope,
  isDynamicNode,
  isFieldNode,
  isParentNode,
  isRootNode,
} from "./index"

import type {
  ContainerNode,
  DynamicNode,
  DynamicRowState,
  NodeId,
  ParentNode,
  RootNode,
  SchemaNode,
} from "./index"
import type { NamePath, Values } from "../types"

/**
 * 已挂载字段、数组根或数组行的目标路径。
 * @typeParam TValues - 表单值类型。
 */
export interface NodePathUpdate<TValues extends Values = Values> {
  /**
   * 保持不变的节点或行身份。
   */
  readonly nodeId: NodeId
  /**
   * 本次提交后的业务路径。
   */
  readonly path: NamePath<TValues>
}

/**
 * Node 树的管理接口。
 *
 * NodeManager 维护节点与路径索引、数组行归属、父子关系和 childNodes 顺序；节点资源的生命周期由
 * reconciler 和 NodeLifecycle 负责。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const manager = createNodeManager()
 * manager.insert(node, manager.getRoot().id)
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
   * 响应式读取活动字段、数组根或数组行的当前路径。
   *
   * @param nodeId - 要查询的身份。
   * @example const path = manager.getPath(fieldId)
   */
  getPath(nodeId: NodeId): NamePath<TValues> | undefined
  /**
   * 返回按规范化路径去重的快照，顺序与路径首次登记顺序一致。
   * @example const paths = manager.getPaths()
   */
  getPaths(): readonly NamePath<TValues>[]
  /**
   * 返回路径上最先登记的活动身份；不存在时返回 undefined。
   *
   * @param path - 要查询的业务路径。
   * @example const id = manager.getNodeId("name")
   */
  getNodeId(path: NamePath<TValues>): NodeId | undefined
  /**
   * 返回同路径的全部活动身份快照，顺序不随树重排变化。
   *
   * @param path - 要查询的业务路径。
   * @example const ids = manager.getNodeIds("name")
   */
  getNodeIds(path: NamePath<TValues>): readonly NodeId[]
  /**
   * 先校验整批身份，再同步更新路径状态与索引；支持路径交换。
   * 编译配置由资源层在同一批次写入；数组根路径从已更新配置读取。
   *
   * @param updates - 身份唯一的目标路径列表。
   * @throws 未知身份、无路径节点或重复身份导致整批不写入。
   * @example manager.updatePaths([{ nodeId: fieldId, path: "nickname" }])
   */
  updatePaths(updates: readonly NodePathUpdate<TValues>[]): void
  /**
   * 同步数组行状态、归属和路径索引，行不加入树节点集合。
   *
   * @param arrayId - 已插入树中的 Dynamic 节点身份。
   * @param rows - 根据 Store 行 key 协调后的完整行列表。
   * @example manager.setArrayRows(arrayId, [{ id: rowId, key: "row", index: 0, path: "users.0" }])
   */
  setArrayRows(arrayId: NodeId, rows: readonly DynamicRowState[]): void

  /**
   * 获取节点的直接子节点。
   *
   * @param id - 要查询的节点 id。
   * @returns 子节点列表；未知节点或不可承载子节点的节点返回空数组。
   */
  getChildren(id: NodeId): readonly SchemaNode<TValues>[]

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
  const nodes = new Map<NodeId, ContainerNode<TValues>>([[root.id, root]])

  // 反向记录保留已登记的路径写法，用于同步更新和删除旧索引。
  const nodePaths = new Map<NodeId, NamePath<TValues>>()

  // 同一路径可短暂包含替换前后的节点，注销时按身份独立删除。
  const pathNodes = new Map<string, Set<NodeId>>()

  // 数组行没有独立树节点，通过所属 Dynamic 读取响应式行状态。
  const arrayOwners = new Map<NodeId, NodeId>()

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

      if (nodes.has(current.id) || arrayOwners.has(current.id)) {
        throw new Error(`[schemx] Node "${current.id}" already exists`)
      }

      localIds.add(current.id)
    }

    // 行与 Schema 节点共享 ID 空间，必须在写入任何索引之前校验整棵子树。
    for (const current of subtree) {
      if (!isDynamicNode(current)) {
        continue
      }

      for (const row of current.dynamicRows.peek()) {
        if (localIds.has(row.id) || nodes.has(row.id) || arrayOwners.has(row.id)) {
          throw new Error(`[schemx] Duplicate array row id "${row.id}".`)
        }

        localIds.add(row.id)
      }
    }

    for (const current of subtree) {
      nodes.set(current.id, current)
      if (isFieldNode(current)) {
        registerPath(current.id, current.name.peek())
      } else if (isDynamicNode(current)) {
        registerPath(current.id, current.compiledSchema.peek().name as NamePath<TValues>)
        setArrayRows(current.id, current.dynamicRows.peek())
      }
    }
  }

  /**
   * 从索引移除已脱离树结构的整棵子树。
   *
   * @param subtree - 要移除的节点列表。
   */
  function unregisterNodes(subtree: readonly ContainerNode<TValues>[]): void {
    for (const current of subtree) {
      if (isDynamicNode(current)) {
        for (const row of current.dynamicRows.peek()) {
          removePath(row.id)
          arrayOwners.delete(row.id)
        }
      }

      removePath(current.id)
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

  /**
   * 删除单个身份的旧路径，不影响同地址的其他身份。
   * @param nodeId - 要解除路径索引的身份。
   */
  const removePath = (nodeId: NodeId): void => {
    // 删除时使用先前登记的路径，不依赖已更新的节点 Signal。
    const path = nodePaths.get(nodeId)

    if (path === undefined) {
      return
    }

    // 旧路径的规范化身份。
    const key = createFieldKey(path)

    // 同地址仍需保留的其他身份。
    const ids = pathNodes.get(key)

    ids?.delete(nodeId)
    if (ids?.size === 0) {
      pathNodes.delete(key)
    }

    nodePaths.delete(nodeId)
  }

  /**
   * 更新双向路径索引，相同写法不改变登记顺序。
   * @param nodeId - 已确认有效的节点或行身份。
   * @param path - 当前提交的路径。
   */
  const registerPath = (nodeId: NodeId, path: NamePath<TValues>): void => {
    if (nodePaths.get(nodeId) === path) {
      return
    }

    removePath(nodeId)
    // 路径写法不同但指向同一地址时共用此键。
    const key = createFieldKey(path)

    // Set 保留当前路径上各身份的登记顺序。
    const ids = pathNodes.get(key) ?? new Set<NodeId>()

    ids.add(nodeId)
    pathNodes.set(key, ids)
    nodePaths.set(nodeId, path)
  }

  /**
   * 复用现有节点与行的信号，不为查询新增响应式索引。
   * @param nodeId - 要读取路径的身份。
   */
  const getPath = (nodeId: NodeId): NamePath<TValues> | undefined => {
    // Schema 节点的路径继续由原有 Signal 驱动。
    const node = nodes.get(nodeId)

    if (isFieldNode(node)) {
      return node.disposed.value ? undefined : node.name.value
    }

    if (isDynamicNode(node)) {
      return node.disposed.value
        ? undefined
        : (node.compiledSchema.value.name as NamePath<TValues>)
    }

    // 数组行通过稳定身份关联所属容器。
    const ownerId = arrayOwners.get(nodeId)

    // 容器的原生行 Signal 负责通知路径变更。
    const owner = ownerId === undefined ? undefined : nodes.get(ownerId)

    if (isDynamicNode(owner) && !owner.disposed.value) {
      // row 是容器中待匹配当前身份的行记录。
      return owner.dynamicRows.value.find((row) => row.id === nodeId)?.path as
        NamePath<TValues> | undefined
    }

    return undefined
  }

  // 快照按当前路径桶顺序取代表写法，不暴露内部集合。
  const getPaths = (): readonly NamePath<TValues>[] => {
    // 每个非空路径桶只返回一个代表写法。
    const paths: NamePath<TValues>[] = []

    for (const ids of pathNodes.values()) {
      // 最早登记的身份提供该地址的代表写法。
      const first = ids.values().next().value

      if (first !== undefined) {
        // 保留该身份提交时使用的路径格式。
        const path = nodePaths.get(first)

        if (path !== undefined) {
          paths.push(path)
        }
      }
    }

    return paths
  }

  /**
   * 直接读取第一个身份，避免创建完整集合快照。
   * @param path - 当前业务路径。
   */
  const getNodeId = (path: NamePath<TValues>): NodeId | undefined =>
    pathNodes.get(createFieldKey(path))?.values().next().value

  /**
   * 复制同路径身份，调用方不能修改内部索引。
   * @param path - 当前业务路径。
   */
  const getNodeIds = (path: NamePath<TValues>): readonly NodeId[] => [
    ...(pathNodes.get(createFieldKey(path)) ?? []),
  ]

  /**
   * 校验完整行列表后，在同一批次发布归属、路径与行信号。
   * @param arrayId - 目标 Dynamic 节点身份。
   * @param rows - Store 结构协调后的全部行。
   */
  const setArrayRows = (arrayId: NodeId, rows: readonly DynamicRowState[]): void => {
    assertManagerAvailable()
    // 只允许已经插入树的 Dynamic 拥有行身份。
    const node = requireNode(arrayId)

    if (!isDynamicNode(node)) {
      throw new Error(`[schemx] Node "${arrayId}" is not a Dynamic node.`)
    }

    // 整批行身份在写入前校验，防止部分更新。
    const nextIds = new Set<NodeId>()

    for (const row of rows) {
      // 已登记的行只能由原来的数组继续持有。
      const owner = arrayOwners.get(row.id)

      if (
        nextIds.has(row.id) ||
        nodes.has(row.id) ||
        (owner !== undefined && owner !== arrayId)
      ) {
        throw new Error(`[schemx] Duplicate array row id "${row.id}".`)
      }

      nextIds.add(row.id)
    }

    batch(() => {
      for (const row of node.dynamicRows.peek()) {
        if (!nextIds.has(row.id)) {
          removePath(row.id)
          arrayOwners.delete(row.id)
        }
      }

      for (const row of rows) {
        arrayOwners.set(row.id, arrayId)
        registerPath(row.id, row.path as NamePath<TValues>)
      }

      node.dynamicRows.value = rows
    })
  }

  /**
   * 整批校验后更新字段、行路径和索引；编译配置、取消域和领域资源由调用方管理。
   * @param updates - 每个身份最多出现一次的路径更新。
   */
  const updatePaths = (updates: readonly NodePathUpdate<TValues>[]): void => {
    assertManagerAvailable()
    // 先完成整批身份校验，失败时不修改 Signal 或索引。
    const ids = new Set<NodeId>()

    for (const { nodeId } of updates) {
      if (ids.has(nodeId) || !nodePaths.has(nodeId)) {
        throw new Error(`[schemx] Invalid or duplicated path node "${nodeId}".`)
      }

      ids.add(nodeId)
    }

    // 同一数组中的多个行更新只发布一次完整行列表。
    const rowUpdates = new Map<DynamicNode<TValues>, Map<NodeId, string>>()

    batch(() => {
      for (const { nodeId, path } of updates) {
        if (nodePaths.get(nodeId) === path) {
          continue
        }

        registerPath(nodeId, path)
        // 有树节点的身份直接同步节点路径，其余身份按数组行处理。
        const node = nodes.get(nodeId)

        if (isFieldNode(node)) {
          node.name.value = path
        } else {
          // 输入已通过身份校验，此处恢复行所属的 Dynamic。
          const ownerId = arrayOwners.get(nodeId)

          // 容器按身份收集更新，最后一次性发布行列表。
          const owner = ownerId === undefined ? undefined : nodes.get(ownerId)

          if (isDynamicNode(owner)) {
            // 当前数组各行本次提交的目标地址。
            const paths = rowUpdates.get(owner) ?? new Map<NodeId, string>()

            paths.set(nodeId, String(path))
            rowUpdates.set(owner, paths)
          }
        }
      }

      for (const [owner, paths] of rowUpdates) {
        // row 为原行状态，仅为地址变化的行创建新记录。
        owner.dynamicRows.value = owner.dynamicRows.peek().map((row) => {
          // 未包含在本次更新中的行复用原有记录。
          const path = paths.get(row.id)

          return path === undefined ? row : { ...row, path }
        })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // 关系查询
  // ---------------------------------------------------------------------------

  function getChildren(id: NodeId): readonly SchemaNode<TValues>[] {
    const node = nodes.get(id)

    if (!node || !isParentNode(node)) {
      return []
    }

    return readChildren(node)
  }

  function getIndex(id: NodeId): number | undefined {
    const node = nodes.get(id)

    if (!node?.parent) {
      return undefined
    }

    const index = childIndex(node.parent, id)

    return index >= 0 ? index : undefined
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
      unregisterNodes(removed)
      writeChildren(parent, children)

      for (const current of removed) {
        if (isParentNode(current)) {
          writeChildren(current, [])
        }

        current.parent = null
      }
    })

    return removed
  }

  function clear(): readonly ContainerNode<TValues>[] {
    assertManagerAvailable()

    const children = readChildren(root)

    const removed: ContainerNode<TValues>[] = []

    for (const child of children) {
      removed.push(...remove(child.id))
    }

    return removed
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
    nodePaths.clear()
    pathNodes.clear()
    arrayOwners.clear()
    disposed = true
  }

  function values(): ContainerNode<TValues>[] {
    return [...nodes.values()]
  }

  return {
    // 基础查询
    get,
    has,
    getRoot,
    getPath,
    getPaths,
    getNodeId,
    getNodeIds,
    updatePaths,
    setArrayRows,

    // 关系查询
    getChildren,
    getIndex,
    getDescendants,

    // 插入
    insert,

    // 移动
    move,

    // 删除
    remove,
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
