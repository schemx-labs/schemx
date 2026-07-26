/**
 * RuntimeNodeManager - runtime tree 结构管理器。
 *
 * 该模块只维护 RuntimeNode tree 和 `nodes` Map 的一致性，不挂载 descriptor、
 * field state、dependency effect、validation effect 或 view state。
 *
 * @module core/runtime/node/runtimeNodeManager
 */

import { deleteNodeResources } from "./resources"
import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "./runtimeNode"
import { createScope } from "./scope"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FormDescriptor } from "../descriptor"
import type {
  ContainerRuntimeNode,
  CreateRuntimeNodeOptions,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeManager,
  RuntimeNodeResourceContext,
} from "./types"

/**
 * 创建 RuntimeNodeManager 实例。
 *
 * Manager 通过 SchemaRuntimeContext 中的 nodeResources 管理所有节点的生命周期和树结构。
 * 内部维护自增 ID，确保每个节点有唯一的 RuntimeNodeId。
 *
 * @typeParam TValues - 表单值类型
 * @param context - 表单运行时上下文
 * @returns RuntimeNodeManager 实例
 */
export function createRuntimeNodeManager<TValues extends Values = Values>(
  context: SchemaRuntimeContext<TValues>
): RuntimeNodeManager<TValues> {
  const resources = context.nodeResources

  let nextId = 1

  /**
   * 创建并注册根节点。
   */
  function createRoot(): RootRuntimeNode<TValues> {
    const node = createRootRuntimeNode<TValues>({
      dispose: createScope(),
    })

    registerNode(resources, node)

    return node
  }

  /**
   * 根据 descriptor 创建节点，并将节点挂载到指定父节点。
   *
   * 从 descriptor.type 推断节点类型，自动继承父节点 scope 作为 dispose。
   *
   * @param descriptor - 表单描述符
   * @param parent - 目标父容器节点
   * @returns 新创建的描述节点
   */
  function create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DescribedRuntimeNode<TValues> {
    assertNodeAvailable(parent)

    const node = createNode({
      type: descriptor.type,
      key: descriptor.key,
      parent,
      dispose: parent.dispose.child(),
    })

    insertChild(parent, node)

    return node
  }

  /**
   * 创建并注册一个尚未挂载的描述节点。
   *
   * 根据 type 创建对应的节点类型（field / group / dependency），
   * 分配自增 ID，注册到 resources.nodes Map 后返回。
   *
   * @param createOptions - 创建选项
   * @returns 新创建的描述节点（尚未挂载到父节点）
   */
  function createNode(
    createOptions: CreateRuntimeNodeOptions<TValues>
  ): DescribedRuntimeNode<TValues> {
    const nodeId = nextId++

    const dispose = createOptions.dispose ?? createScope()

    const baseOptions = {
      id: nodeId,
      key: createOptions.key,
      parent: createOptions.parent,
      dispose,
    }

    let node: DescribedRuntimeNode<TValues>

    switch (createOptions.type) {
      case "field":
        node = createFieldRuntimeNode<TValues>(baseOptions)
        break

      case "group":
        node = createGroupRuntimeNode<TValues>(baseOptions)
        break

      case "dependency":
        node = createDependencyRuntimeNode<TValues>(baseOptions)
        break

      default:
        return assertNever(createOptions.type)
    }

    registerNode(resources, node)

    return node
  }

  /**
   * 根据节点 ID 获取 RuntimeNode。
   *
   * @param nodeId - 节点 ID
   * @returns RuntimeNode 实例，不存在时返回 undefined
   */
  function getNode(nodeId: number): RuntimeNode<TValues> | undefined {
    return resources.nodes.get(nodeId)
  }

  /**
   * 深度优先遍历指定节点及其全部后代节点。
   *
   * 当检测到重复节点或循环引用时直接抛出异常，避免无限递归。
   *
   * @param root - 遍历起始节点
   * @returns 包含 root 自身及其所有后代节点的数组
   * @throws 检测到循环引用或重复节点时抛出
   */
  function traverse(root: RuntimeNode<TValues>): RuntimeNode<TValues>[] {
    const result: RuntimeNode<TValues>[] = []

    const visited = new Set<RuntimeNode<TValues>>()

    /**
     * 递归访问节点及其子节点，收集到 result 并检测循环/重复引用。
     *
     * @param node - 当前访问的节点
     */
    function visit(node: RuntimeNode<TValues>): void {
      if (visited.has(node)) {
        throw new Error(`Circular or duplicated runtime node detected: ${node.id}.`)
      }

      visited.add(node)
      result.push(node)

      if (node.type === "field") {
        return
      }

      for (const child of node.childNodes.value) {
        visit(child)
      }
    }

    visit(root)

    return result
  }

  /**
   * 将一个节点插入指定父节点。
   *
   * - 如果节点已属于其他父节点，会先从原父节点中移除。
   * - 如果节点已属于当前父节点，相当于调整节点位置。
   * - index 未传入时，默认将节点移动或插入到末尾。
   *
   * @param parent - 目标父容器节点
   * @param child - 要插入的子节点
   * @param index - 插入位置索引，默认末尾
   */
  function insertChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>,
    index = parent.childNodes.value.length
  ): void {
    assertNodeAvailable(parent)
    assertNodeAvailable(child)
    assertCanAttach(parent, child)

    const previousParent = child.parent

    if (previousParent && previousParent !== parent) {
      detachChild(previousParent, child)
    }

    const nextChildren = parent.childNodes.value.filter((current) => current !== child)

    const normalizedIndex = normalizeIndex(index, nextChildren.length)

    nextChildren.splice(normalizedIndex, 0, child)

    child.parent = parent
    setChildren(parent, nextChildren)
  }

  /**
   * 使用指定节点集合替换父节点的全部子节点。
   *
   * - 自动按引用去重，并保留首次出现时的顺序。
   * - 自动从旧父节点迁移传入的节点。
   * - 自动清理被移除节点的 parent 引用。
   *
   * @param parent - 目标父容器节点
   * @param children - 新的子节点列表
   */
  function replaceChildren(
    parent: ContainerRuntimeNode<TValues>,
    children: readonly DescribedRuntimeNode<TValues>[]
  ): void {
    assertNodeAvailable(parent)

    const previousChildren = parent.childNodes.value

    const nextChildren: DescribedRuntimeNode<TValues>[] = []

    const nextChildrenSet = new Set<DescribedRuntimeNode<TValues>>()

    /*
     * 先完成参数校验和去重。
     *
     * 必须在修改树结构之前完成所有校验，避免校验失败时只完成了部分修改。
     */
    for (const child of children) {
      assertNodeAvailable(child)
      assertCanAttach(parent, child)

      if (nextChildrenSet.has(child)) {
        continue
      }

      nextChildrenSet.add(child)
      nextChildren.push(child)
    }

    /*
     * 将新子节点从其他父节点中移除。
     */
    for (const child of nextChildren) {
      const previousParent = child.parent

      if (previousParent && previousParent !== parent) {
        detachChild(previousParent, child)
      }
    }

    /*
     * 清理不再属于当前父节点的旧子节点。
     */
    for (const child of previousChildren) {
      if (!nextChildrenSet.has(child) && child.parent === parent) {
        child.parent = null
      }
    }

    /*
     * 建立新的父子关系。
     */
    for (const child of nextChildren) {
      child.parent = parent
    }

    setChildren(parent, nextChildren)
  }

  /**
   * 从指定父节点中移除一个直接子节点。
   *
   * 不会释放节点资源，也不会删除节点的后代节点。
   *
   * @param parent - 父容器节点
   * @param child - 要移除的子节点
   */
  function removeChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void {
    detachChild(parent, child)
  }

  /**
   * 删除指定节点及其完整子树。
   *
   * 删除过程包括：
   * - 从父节点中解除关系；
   * - 递归释放子节点；
   * - 释放节点 scope；
   * - 删除节点相关资源；
   * - 从 nodes Map 中移除节点。
   *
   * @param node - 要删除的子树根节点
   */
  function removeSubtree(node: RuntimeNode<TValues>): void {
    const visited = new Set<RuntimeNode<TValues>>()

    /**
     * 递归卸载并移除子树节点，复用 visited 集合检测循环引用。
     *
     * @param current - 当前待移除的节点
     */
    function remove(current: RuntimeNode<TValues>): void {
      if (current.disposed.value) {
        return
      }

      if (visited.has(current)) {
        throw new Error(
          `Circular runtime node detected while removing subtree: ${current.id}.`
        )
      }

      visited.add(current)

      /*
       * 使用快照遍历，避免递归过程中修改 childNodes 影响当前迭代。
       */
      const children = current.type === "field" ? [] : [...current.childNodes.value]

      for (const child of children) {
        remove(child)
      }

      if (current.type !== "field") {
        setChildren(current, [])
      }

      const parent = current.parent

      if (parent) {
        detachChild(parent, current as DescribedRuntimeNode<TValues>)
      }

      current.parent = null
      current.disposed.value = true

      /*
       * Scope.dispose() 应当具备幂等性。
       *
       * 子节点已先被递归释放，因此父 scope 即使同时管理子 scope，
       * 也不应因为重复调用而产生副作用。
       */
      current.dispose.dispose()

      deleteNodeResources(resources, current.id)
    }

    remove(node)
  }

  /**
   * 解除指定父节点和子节点的关系。
   *
   * 即使 child.parent 与传入 parent 不一致，也会尝试清理
   * parent.childNodes 中可能存在的异常引用。
   *
   * @param parent - 父容器节点
   * @param child - 要解除关系的子节点
   */
  function detachChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void {
    const currentChildren = parent.childNodes.value

    if (currentChildren.includes(child)) {
      const nextChildren = currentChildren.filter((current) => current !== child)

      setChildren(parent, nextChildren)
    }

    if (child.parent === parent) {
      child.parent = null
    }
  }

  /**
   * 批量设置容器节点的子节点。
   *
   * 始终创建新数组，确保响应式系统能够检测到变更。
   *
   * @param node - 容器节点
   * @param children - 新的子节点列表
   */
  function setChildren(
    node: ContainerRuntimeNode<TValues>,
    children: readonly DescribedRuntimeNode<TValues>[]
  ): void {
    node.childNodes.value = [...children]
  }

  /**
   * 检查指定节点是否允许挂载到目标父节点。
   *
   * 不允许：
   * - 节点成为自己的子节点；
   * - 祖先节点挂载到自己的后代节点；
   * - 形成任何父节点方向的循环引用。
   *
   * @param parent - 目标父容器节点
   * @param child - 要挂载的子节点
   * @throws 如果形成循环引用则抛出
   */
  function assertCanAttach(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void {
    const visited = new Set<RuntimeNode<TValues>>()

    let current: RuntimeNode<TValues> | null = parent

    while (current) {
      if (current === child) {
        throw new Error(
          `Runtime node ${child.id} cannot be attached to itself or one of its descendants.`
        )
      }

      if (visited.has(current)) {
        throw new Error(
          `Circular parent relationship detected at runtime node ${current.id}.`
        )
      }

      visited.add(current)
      current = current.parent
    }
  }

  /**
   * 禁止继续操作已经释放的节点。
   *
   * @param node - 要检查的节点
   * @throws 如果节点已释放则抛出
   */
  function assertNodeAvailable(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      throw new Error(`Runtime node ${node.id} has already been disposed.`)
    }
  }

  return {
    resources,
    nodes: resources.nodes,
    createRoot,
    create,
    createNode,
    getNode,
    traverse,
    insertChild,
    replaceChildren,
    removeChild,
    removeSubtree,
  }
}

/**
 * 将节点注册到 RuntimeNode 资源容器。
 *
 * @typeParam TValues - 表单值类型
 * @param resources - 资源注册表
 * @param node - 要注册的节点
 * @throws 如果节点 ID 已存在则抛出
 */
function registerNode<TValues extends Values>(
  resources: RuntimeNodeResourceContext<TValues>,
  node: RuntimeNode<TValues>
): void {
  if (resources.nodes.has(node.id)) {
    throw new Error(`Runtime node ID already exists: ${node.id}.`)
  }

  resources.nodes.set(node.id, node)
}

/**
 * 将索引限制在有效的数组插入范围内。
 *
 * @param index - 原始索引值
 * @param length - 数组长度
 * @returns 限制后的有效索引
 */
function normalizeIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) {
    return length
  }

  return Math.max(0, Math.min(Math.trunc(index), length))
}

/**
 * TypeScript 穷尽检查。
 *
 * 当 switch 语句未覆盖所有可能的节点类型时触发编译错误。
 *
 * @param value - 未被识别的类型值
 * @throws 始终抛出
 */
function assertNever(value: never): never {
  throw new Error(`Unsupported runtime node type: ${String(value)}.`)
}
