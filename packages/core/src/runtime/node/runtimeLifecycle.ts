/**
 * RuntimeNode 生命周期管理。
 *
 * 负责 RuntimeNode 的挂载、更新、卸载操作，协调领域资源
 * （字段状态、视图状态、dependency effect）的创建与销毁，
 * 并通过 lifecycleBus 发出生命周期事件供外部监听。
 *
 * @module core/runtime/node/runtimeLifecycle
 */

import {
  mountDependencyRuntime,
  unmountDependencyRuntime,
  updateDependencyRuntime,
} from "../dependency"
import { mountFieldRuntime, unmountFieldRuntime, updateFieldRuntime } from "../field"
import {
  mountPresentationRuntime,
  unmountPresentationRuntime,
  updatePresentationRuntime,
} from "../presentation"
import { createRuntimeViewState, deleteRuntimeViewState } from "../view/createViewState"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { RuntimeNodeInput } from "./input"
import type { RuntimeNode, SchemaRuntimeNode } from "./types"

/**
 * RuntimeNode 生命周期操作的接口。
 *
 * 提供 mount（挂载）、update（更新）、unmount（卸载）三个核心操作，
 * 以及递归卸载子树的 unmountSubtree。
 *
 * @typeParam TValues - 表单值类型
 */
export interface RuntimeLifecycle<TValues extends Values = Values> {
  /**
   * 挂载节点。
   *
   * 创建领域资源并标记已挂载。
   *
   * @param node - 待挂载的节点
   */
  mount(node: SchemaRuntimeNode<TValues>): void

  /**
   * 更新节点。
   *
   * 当 schema 变化导致节点输入变更时调用，更新配置和领域资源。
   *
   * @param node - 待更新的节点
   * @param input - 最新节点输入。
   */
  update(node: SchemaRuntimeNode<TValues>, input: RuntimeNodeInput<TValues>): void

  /**
   * 卸载单个节点。
   *
   * root 节点不能被卸载。
   *
   * @param node - 待卸载的节点
   */
  unmount(node: RuntimeNode<TValues>): void

  /**
   * 递归卸载整棵子树。
   *
   * 从叶子到根反向遍历，确保子节点先于父节点被卸载。
   *
   * @param node - 子树根节点
   */
  unmountSubtree(node: RuntimeNode<TValues>): void
}

/**
 * 创建 RuntimeNode 生命周期管理器。
 *
 * @typeParam TValues - 表单值类型
 * @param context - 表单运行时上下文，提供 runtimeRegistry、lifecycleBus 等实例级服务
 * @returns RuntimeLifecycle 实例
 */
export function createRuntimeLifecycle<TValues extends Values = Values>(
  context: SchemaRuntimeContext<TValues>
): RuntimeLifecycle<TValues> {
  const bus = context.lifecycleBus

  return {
    mount,
    update,
    unmount,
    unmountSubtree,
  }

  /**
   * 挂载节点并创建领域资源。
   *
   * 挂载顺序：
   * 1. 发出 beforeMount 事件
   * 2. 创建该节点类型的领域资源（字段状态、视图状态、dependency effect）
   * 3. 发出 mount 事件
   */
  function mount(node: SchemaRuntimeNode<TValues>): void {
    if (!node.parent) {
      throw new Error(
        `[schemx] Runtime node "${node.key}" must have a parent before mount.`
      )
    }

    bus.emitBeforeMount(node)

    mountRuntimeResources(node)
    bus.emitMount(node)
  }

  /**
   * 更新节点：校验类型一致性、更新配置和领域资源。
   *
   * 更新时先校验 node.type 与输入类型一致，
   * 然后依次触发 beforeUpdate、更新资源、update、updated 事件。
   *
   * @throws 如果节点类型与新 descriptor 类型不匹配则抛出错误
   */
  function update(
    node: SchemaRuntimeNode<TValues>,
    input: RuntimeNodeInput<TValues>
  ): void {
    if (node.type !== input.type) {
      throw new Error(
        `unexpected runtime node input type: node ${node.type} cannot update with ${input.type}`
      )
    }

    const previousNode = { ...node }

    bus.emitBeforeUpdate(node, previousNode)
    const previousConfig = copyNodeConfig(node)

    applyNodeInput(node, input)
    updateRuntimeResources(node, previousConfig)
    bus.emitUpdated(node, previousNode)
  }

  /**
   * 递归卸载整棵子树。
   *
   * 采用后序遍历（先子后父），确保子节点的资源在父节点之前被释放。
   * field 节点没有子节点，直接卸载自身。
   */
  function unmountSubtree(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      return
    }

    for (const child of node.type === "field" ? [] : node.childNodes.value) {
      unmountSubtree(child)
    }

    unmount(node)
  }

  /**
   * 卸载单个节点。
   *
   * root 节点不能被卸载（直接返回）。
   * 卸载顺序：发出 beforeUnmount 事件、释放领域资源、发出 unmount 事件。
   */
  function unmount(node: RuntimeNode<TValues>): void {
    if (node.type === "root") {
      return
    }

    bus.emitBeforeUnmount(node)
    unmountRuntimeResources(node)
    bus.emitUnmount(node)
  }

  /**
   * 根据节点类型挂载对应的领域资源。
   *
   * - field 节点：挂载字段运行时状态（验证器、校验 effect 等）
   * - group 节点：创建运行时视图状态
   * - dependency 节点：挂载 dependency effect（动态子节点渲染）
   */
  function mountRuntimeResources(node: SchemaRuntimeNode<TValues>): void {
    if (node.type === "field") {
      mountFieldRuntime(node, context)

      return
    }

    if (node.type === "group") {
      mountGroupResources(node)

      return
    }

    if (node.type === "dependency") {
      mountDependencyRuntime(node, context)
    }
  }

  /**
   * 根据节点类型更新对应的领域资源。
   *
   * - field 节点：更新字段运行时状态
   * - group 节点：重新挂载 group 资源（视图状态重建）
   * - dependency 节点：更新 dependency effect
   */
  function updateRuntimeResources(
    node: SchemaRuntimeNode<TValues>,
    previousConfig: RuntimeNodeInput<TValues>
  ): void {
    if (node.type === "field" && previousConfig.type === "field") {
      updateFieldRuntime(node, previousConfig.name, previousConfig.dynamicProps, context)

      return
    }

    if (node.type === "group" && previousConfig.type === "group") {
      mountGroupResources(node, previousConfig.dynamicProps)

      return
    }

    if (node.type === "dependency" && previousConfig.type === "dependency") {
      updateDependencyRuntime(
        node,
        previousConfig.triggerFields,
        previousConfig.rendererIdentity,
        previousConfig.dynamicProps,
        context
      )
    }
  }

  /**
   * 挂载 group 节点的资源。
   *
   * Group 节点依次挂载容器状态、动态属性 effect 和运行时视图状态。
   */
  function mountGroupResources(
    node: Extract<RuntimeNode<TValues>, { type: "group" }>,
    previousDynamicProps?: Extract<
      RuntimeNodeInput<TValues>,
      { type: "group" }
    >["dynamicProps"]
  ): void {
    if (node.presentationState) {
      updatePresentationRuntime(node, previousDynamicProps, context)
      createRuntimeViewState(node, context.debug)

      return
    }

    mountPresentationRuntime(node, context)
    createRuntimeViewState(node, context.debug)
  }

  /**
   * 根据节点类型卸载对应的领域资源。
   *
   * 所有节点类型都会先删除运行时视图状态，
   * field 和 dependency 节点还需额外卸载其特定领域资源。
   */
  function unmountRuntimeResources(node: RuntimeNode<TValues>): void {
    deleteRuntimeViewState(node)

    if (node.type === "field") {
      unmountFieldRuntime(node, context)
    } else if (node.type === "group") {
      unmountPresentationRuntime(node)
    } else if (node.type === "dependency") {
      unmountDependencyRuntime(node)
    }
  }
}

/** 从运行时节点复制可用于更新比较的节点输入快照。 */
function copyNodeConfig<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>
): RuntimeNodeInput<TValues> {
  if (node.type === "field") {
    return {
      type: "field",
      key: node.key,
      configToken: node.configToken,
      name: node.name,
      componentType: node.componentType,
      staticSchema: node.staticSchema,
      dynamicProps: node.dynamicProps,
      validation: node.validation,
    }
  }

  if (node.type === "group") {
    return {
      type: "group",
      key: node.key,
      configToken: node.configToken,
      staticSchema: node.staticSchema,
      staticState: node.staticState,
      dynamicProps: node.dynamicProps,
    }
  }

  return {
    type: "dependency",
    key: node.key,
    configToken: node.configToken,
    triggerFields: node.triggerFields,
    renderer: node.renderer,
    rendererIdentity: node.rendererIdentity,
    staticState: node.staticState,
    dynamicProps: node.dynamicProps,
  }
}

/** 将新的编译输入写入运行时节点，并保持节点类型一致。 */
function applyNodeInput<TValues extends Values>(
  node: SchemaRuntimeNode<TValues>,
  input: RuntimeNodeInput<TValues>
): void {
  if (node.type !== input.type) {
    throw new Error(`unexpected runtime node input type: ${input.type}`)
  }

  node.configToken = input.configToken

  if (node.type === "field" && input.type === "field") {
    node.name = input.name
    node.componentType = input.componentType
    node.staticSchema = input.staticSchema
    node.dynamicProps = input.dynamicProps
    node.validation = input.validation

    return
  }

  if (node.type === "group" && input.type === "group") {
    node.staticSchema = input.staticSchema
    node.staticState = input.staticState
    node.dynamicProps = input.dynamicProps

    return
  }

  if (node.type === "dependency" && input.type === "dependency") {
    node.triggerFields = input.triggerFields
    node.renderer = input.renderer
    node.rendererIdentity = input.rendererIdentity
    node.staticState = input.staticState
    node.dynamicProps = input.dynamicProps
  }
}
