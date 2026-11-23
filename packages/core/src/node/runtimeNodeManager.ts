/**
 * RuntimeNodeManager - 单个 RuntimeNode 生命周期执行器。
 *
 * Reconciler 负责决定创建、复用、移动和销毁哪些 RuntimeNode；RuntimeNodeManager 负责执行
 * 单个 RuntimeNode 的创建、挂载、更新和释放，并把字段、dependency 等领域资源挂到 RuntimeNode。
 *
 * @module core/node/runtimeNodeManager
 */

import {
  type DependencyDescriptor,
  type FieldDescriptor,
  type FormDescriptor,
  type GroupDescriptor,
  isDependencyDescriptor,
  isFieldDescriptor,
  isGroupDescriptor,
} from "../descriptor"
import {
  createDependenciesEffect,
  createDependencyEffect,
  createFieldModel,
  createValidationEffect,
  updateFieldModel,
} from "../field"
import { createSignal } from "../reactivity"
import { setByPath } from "../utils"

import {
  getChildRuntimeNodes,
  hasDescriptor,
  isContainerRuntimeNode,
  setChildRuntimeNodes,
} from "./runtimeNode"
import { createScope } from "./scope"

import type { SchemxFormContext } from "../createForm"
import type { FieldRegistry } from "../field"
import type { LifecycleBus } from "../lifecycle"
import type { NamePath, SchemxInstance, Values } from "../types"
import type {
  ContainerRuntimeNode,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
} from "./runtimeNode"

/**
 * 表单 runtime node 的默认 RuntimeNode 生命周期管理器。
 *
 * @typeParam TValues - 表单值类型。
 */
class DefaultRuntimeNodeManager<TValues extends Values = Values> {
  /**
   * 下一个非 root RuntimeNode 的自增 id；root 固定使用 0。
   */
  private nextId = 1
  /**
   * 当前表单运行时上下文的延迟访问器。
   */
  private readonly context: SchemxFormContext<TValues>

  /**
   * 表单实例，定义表单的所有操作方法
   */
  private readonly instance: SchemxInstance<TValues>

  /**
   * 字段运行时索引，用于按字段路径查找 model 与 RuntimeNode。
   */
  private readonly fieldRegistry: FieldRegistry<TValues>
  /**
   * RuntimeNode 生命周期事件总线。
   */
  private readonly lifecycleBus: LifecycleBus<RuntimeNode<TValues>>

  constructor(context: SchemxFormContext<TValues>) {
    this.context = context

    this.fieldRegistry = context.fieldRegistry
    this.instance = context.instance
    this.lifecycleBus = context.lifecycleBus
  }

  /**
   * 创建透明根 RuntimeNode。
   *
   * @returns root RuntimeNode，不对应任何表单 descriptor。
   */
  createRoot(): RootRuntimeNode<TValues> {
    return {
      id: 0,
      key: "schemx:root",
      type: "root",
      parent: null,
      scope: createScope(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      childNodes: [],
    }
  }

  /**
   * 根据 descriptor 创建单个未挂载 RuntimeNode。
   *
   * @param descriptor - 编译后的表单节点描述符。
   * @param parent - 新 RuntimeNode 所属的容器 RuntimeNode。
   */
  create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DescribedRuntimeNode<TValues> {
    if (descriptor.type === "field") {
      return this.createField(descriptor, parent)
    }

    if (descriptor.type === "group") {
      return this.createGroup(descriptor, parent)
    }

    if (descriptor.type === "dependency") {
      return this.createDependency(descriptor, parent)
    }

    throwUnknownDescriptor(descriptor)
  }

  /**
   * 挂载单个 RuntimeNode 的运行期资源。
   *
   * @param node - 要挂载的 RuntimeNode。
   *
   * @remarks
   * Group RuntimeNode 只表示结构，不会创建领域资源；Field 和 Dependency 会在这里
   * 创建各自的模型、effect 与资源 scope。
   */
  mount(node: RuntimeNode<TValues>): void {
    if (!hasDescriptor(node)) {
      return
    }

    this.lifecycleBus.emitBeforeMount(node)

    switch (node.type) {
      case "field":
        this.mountField(node)
        break
      case "group":
        this.mountGroup(node)
        break
      case "dependency":
        this.mountDependency(node)
        break
    }

    node.mounted.value = true
    this.lifecycleBus.emitMount(node)
  }

  /**
   * 更新单个 RuntimeNode 的 descriptor 快照和运行期资源。
   *
   * @param node - 要更新的 RuntimeNode。
   * @param next - 更新后的表单 descriptor。
   *
   * @remarks
   * descriptor 快照会先写入 RuntimeNode，再由具体 update 分支决定复用还是重启资源。
   * 结构层面的 children reconcile 不在这里处理。
   */
  update(node: RuntimeNode<TValues>, next: FormDescriptor<TValues>): void {
    if (!hasDescriptor(node)) {
      return
    }

    switch (node.type) {
      case "field": {
        if (!isFieldDescriptor(next)) {
          throwUnexpectedDescriptor(node, next)
        }

        const previousNode = createPreviousRuntimeNodeSnapshot(node)

        this.lifecycleBus.emitBeforeUpdate(node, previousNode)
        node.descriptor = next
        this.updateField(node, previousNode)
        this.lifecycleBus.emitUpdate(node, previousNode)
        this.lifecycleBus.emitUpdated(node, previousNode)
        break
      }

      case "group": {
        if (!isGroupDescriptor(next)) {
          throwUnexpectedDescriptor(node, next)
        }

        const previousNode = createPreviousRuntimeNodeSnapshot(node)

        this.lifecycleBus.emitBeforeUpdate(node, previousNode)
        node.descriptor = next
        this.updateGroup(node, next)
        this.lifecycleBus.emitUpdate(node, previousNode)
        this.lifecycleBus.emitUpdated(node, previousNode)
        break
      }

      case "dependency": {
        if (!isDependencyDescriptor(next)) {
          throwUnexpectedDescriptor(node, next)
        }

        const previousNode = createPreviousRuntimeNodeSnapshot(node)

        this.lifecycleBus.emitBeforeUpdate(node, previousNode)
        node.descriptor = next
        this.updateDependency(node, previousNode)
        this.lifecycleBus.emitUpdate(node, previousNode)
        this.lifecycleBus.emitUpdated(node, previousNode)
        break
      }
    }
  }

  /**
   * 卸载单个 RuntimeNode 的运行期资源。
   *
   * @param node - 要卸载的 RuntimeNode。
   *
   * @remarks
   * 这个方法不递归销毁子节点；需要销毁整棵子树时使用 `disposeTree`。
   */
  unmount(node: RuntimeNode<TValues>): void {
    if (!hasDescriptor(node)) {
      return
    }

    switch (node.type) {
      case "field":
        this.unmountField(node)
        break
      case "group":
        this.unmountGroup(node)
        break
      case "dependency":
        this.unmountDependency(node)
        break
    }

    node.mounted.value = false
  }

  /**
   * 递归销毁 RuntimeNode 子树。
   *
   * @param node - 要销毁的子树根 RuntimeNode。
   *
   * @remarks
   * 销毁顺序是：标记 disposed、递归销毁 runtime 子节点、卸载自身领域资源、
   * 释放 RuntimeNode scope、断开 parent。这样可以确保子资源先于父资源释放。
   */
  disposeTree(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      return
    }

    if (node.type !== "root") {
      this.lifecycleBus.emitBeforeUnmount(node)
    }

    node.disposed.value = true

    if (isContainerRuntimeNode(node)) {
      for (const child of getChildRuntimeNodes(node)) {
        this.disposeTree(child)
      }

      setChildRuntimeNodes(node, [])
    }

    this.unmount(node)
    node.scope.dispose()

    node.parent = null

    if (node.type !== "root") {
      this.lifecycleBus.emitUnmount(node)
    }
  }

  private createField(
    descriptor: FieldDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): FieldRuntimeNode<TValues> {
    const fieldModel = createFieldModel(descriptor)

    const node: FieldRuntimeNode<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      fieldModel,
      fieldResourceScope: null,
      fieldDependenciesScope: null,
    }

    return node
  }

  private createGroup(
    descriptor: GroupDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): GroupRuntimeNode<TValues> {
    const node: GroupRuntimeNode<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      childNodes: [],
    }

    return node
  }

  private createDependency(
    descriptor: DependencyDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DependencyRuntimeNode<TValues> {
    const node: DependencyRuntimeNode<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      dependencySlot: null,
      dependencyResourceScope: null,
      dynamicChildNodes: [],
    }

    return node
  }

  private mountField(node: FieldRuntimeNode<TValues>): void {
    const resourceScope = node.scope.child()

    const model = node.fieldModel
    if (!model) {
      return
    }

    this.initializeFieldValue(node)

    node.fieldResourceScope = resourceScope
    this.fieldRegistry.register({
      name: node.descriptor.name,
      node: node,
      model,
    })

    resourceScope.add(() => {
      this.fieldRegistry.unregister(node.descriptor.name, node)

      if (node.fieldResourceScope === resourceScope) {
        node.fieldResourceScope = null
      }
    })

    this.mountFieldValidation(node, model, resourceScope)
    this.mountOrRestartFieldDependencies(node, model)
  }

  private initializeFieldValue(node: FieldRuntimeNode<TValues>): void {
    const { name, schema } = node.descriptor

    if (
      !Object.hasOwn(schema, "initialValue") ||
      this.instance.getFieldSnapshot(name) !== undefined
    ) {
      return
    }

    const values = {} as Partial<TValues>
    setByPath(values, name, schema.initialValue)

    this.instance.setInitialValues(values)
    this.instance.setFieldValue(name, schema.initialValue)
  }

  private mountGroup(_node: GroupRuntimeNode<TValues>): void {
    // group 只参与结构生命周期，不创建领域资源。
  }

  private mountDependency(node: DependencyRuntimeNode<TValues>): void {
    createDependencyEffect<TValues>({
      node,
      descriptor: node.descriptor,
      context: this.context,
    })
  }

  private updateField(
    node: FieldRuntimeNode<TValues>,
    previousNode?: FieldRuntimeNode<TValues>
  ): void {
    const model = node.fieldModel

    if (model && previousNode && previousNode.descriptor.name === node.descriptor.name) {
      updateFieldModel(model, node.descriptor)
      this.fieldRegistry.register({
        name: node.descriptor.name,
        node: node,
        model,
      })
      this.mountOrRestartFieldDependencies(node, model)

      return
    }

    this.unmountField(node)
    this.mountField(node)
  }

  private updateGroup(
    _node: GroupRuntimeNode<TValues>,
    _descriptor: GroupDescriptor<TValues>
  ): void {
    // group 没有领域资源，descriptor 快照已由 update() 写入。
  }

  private updateDependency(
    node: DependencyRuntimeNode<TValues>,
    previousNode: DependencyRuntimeNode<TValues>
  ): void {
    // trigger 订阅属于 dependencyResourceScope；trigger 列表变化时必须重启 effect。
    if (
      !node.dependencySlot ||
      !previousNode ||
      !isSameNamePathList(node.descriptor.trigger, previousNode?.descriptor.trigger)
    ) {
      this.unmountDependency(node)
      this.mountDependency(node)
    }
  }

  private mountFieldValidation(
    node: FieldRuntimeNode<TValues>,
    model = node.fieldModel,
    scope = node.fieldResourceScope
  ): void {
    if (!model || !scope) {
      return
    }

    createValidationEffect<TValues>({
      name: node.descriptor.name,
      fieldModel: model,
      context: this.context,
      scope,
    })
  }

  private mountOrRestartFieldDependencies(
    node: FieldRuntimeNode<TValues>,
    model = node.fieldModel
  ): void {
    node.fieldDependenciesScope?.dispose()

    if (!model || !node.descriptor.dependencies) {
      node.fieldDependenciesScope = null

      return
    }

    const dependenciesScope = node.scope.child()
    node.fieldDependenciesScope = dependenciesScope
    dependenciesScope.add(() => {
      if (node.fieldDependenciesScope === dependenciesScope) {
        node.fieldDependenciesScope = null
      }
    })

    createDependenciesEffect<TValues>({
      descriptor: node.descriptor,
      fieldModel: model,
      context: this.context,
      scope: dependenciesScope,
    })
  }

  private unmountField(node: FieldRuntimeNode<TValues>): void {
    node.fieldDependenciesScope?.dispose()
    node.fieldDependenciesScope = null
    node.fieldResourceScope?.dispose()
    node.fieldResourceScope = null
  }

  private unmountGroup(_node: GroupRuntimeNode<TValues>): void {
    // group 只参与结构生命周期，不创建领域资源。
  }

  private unmountDependency(node: DependencyRuntimeNode<TValues>): void {
    node.dependencyResourceScope?.dispose()
    node.dependencyResourceScope = null
    node.dependencySlot = null
  }
}

/**
 * RuntimeNodeManager 的实例类型。
 */
export type RuntimeNodeManager<TValues extends Values = Values> = InstanceType<
  typeof DefaultRuntimeNodeManager<TValues>
>

/**
 * 创建表单运行时 RuntimeNodeManager。
 *
 * @param context - manager 所需的上下文、注册表和生命周期总线。
 * @returns 新的 DefaultRuntimeNodeManager 实例。
 */
export function createRuntimeNodeManager<TValues extends Values = Values>(
  context: SchemxFormContext<TValues>
): DefaultRuntimeNodeManager<TValues> {
  return new DefaultRuntimeNodeManager(context)
}

function isSameNamePathList(a: NamePath[], b: NamePath[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((name, index) => name === b[index])
}

function createPreviousRuntimeNodeSnapshot<TNode extends DescribedRuntimeNode<any>>(
  node: TNode
): TNode {
  return { ...node }
}

function throwUnknownDescriptor(descriptor: never): never {
  throw new Error(`unknown type: ${(descriptor as { type?: string }).type ?? "unknown"}`)
}

function throwUnexpectedDescriptor<TValues extends Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>
): never {
  throw new Error(
    `unexpected descriptor type: node ${node.type} cannot update with ${descriptor.type}`
  )
}
