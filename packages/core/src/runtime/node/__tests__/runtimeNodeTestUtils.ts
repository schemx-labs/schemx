/**
 * 运行时节点（RuntimeNode）的测试辅助工具。
 *
 * 提供创建 RootRuntimeNode、FieldRuntimeNode、GroupRuntimeNode 和
 * DependencyRuntimeNode 的工厂函数，用于隔离测试节点结构操作。
 *
 * @module core/runtime/node/__tests__/runtimeNodeTestUtils
 */
import { createSignal } from "../../../reactivity"
import { createRuntimeScope } from "../runtimeScope"

import {
  createFieldRuntimeSignals,
  createInheritedPresentationState,
  createPresentationRuntimeSignals,
} from "./runtimeSignalsTestUtils"

import type { Values } from "../../../types"
import type {
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  ParentRuntimeNode,
  RootRuntimeNode,
  RuntimeScope,
} from "../types"

/** 仅供测试创建 RootRuntimeNode。 */
export function createRootRuntimeNode(options: { scope: RuntimeScope }): RootRuntimeNode {
  return {
    id: 0,
    key: "schemx:root",
    type: "root",
    parent: null,
    scope: options.scope,
    disposed: createSignal(false),
    childNodes: createSignal([]),
    viewSchemas: null,
  }
}

/** 仅供测试创建 FieldRuntimeNode。 */
export function createFieldRuntimeNode<TValues extends Values = Values>(
  options: CreateFieldRuntimeNodeOptions<TValues>
): FieldRuntimeNode<TValues> {
  const signals = createFieldRuntimeSignals<TValues>({
    nodeId: options.id,
    key: options.key,
    name: options.name,
    staticSchema: options.staticSchema,
    inheritedState: createInheritedPresentationState(() => node),
    debug: options.debug,
  })

  const node: FieldRuntimeNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "field",
    parent: null,
    scope: options.scope ?? createRuntimeScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    ...signals,
    viewSchemas: null,
    validationEffectScope: null,
    dependenciesEffectScope: null,
  }

  return node
}

/** 仅供测试创建 GroupRuntimeNode。 */
export function createGroupRuntimeNode<TValues extends Values = Values>(
  options: CreateGroupRuntimeNodeOptions<TValues>
): GroupRuntimeNode<TValues> {
  const staticSchema = createSignal(options.staticSchema)

  const signals = createPresentationRuntimeSignals({
    nodeId: options.id,
    getStaticState: () => ({
      visible: staticSchema.value.visible ?? true,
      readonly: staticSchema.value.readonly ?? false,
      disabled: staticSchema.value.disabled ?? false,
    }),
    inheritedState: createInheritedPresentationState(() => node),
  })

  const node: GroupRuntimeNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "group",
    parent: null,
    scope: options.scope ?? createRuntimeScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    staticSchema,
    ...signals,
    viewSchemas: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  return node
}

/** 仅供测试创建 DependencyRuntimeNode。 */
export function createDependencyRuntimeNode<TValues extends Values = Values>(
  options: CreateDependencyRuntimeNodeOptions<TValues>
): DependencyRuntimeNode<TValues> {
  const staticSchema = createSignal(options.staticSchema)

  const signals = createPresentationRuntimeSignals({
    nodeId: options.id,
    getStaticState: () => ({
      visible: staticSchema.value.visible ?? true,
      readonly: staticSchema.value.readonly ?? false,
      disabled: staticSchema.value.disabled ?? false,
    }),
    inheritedState: createInheritedPresentationState(() => node),
  })

  const node: DependencyRuntimeNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "dependency",
    parent: null,
    scope: options.scope ?? createRuntimeScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    staticSchema,
    ...signals,
    viewSchemas: null,
    rendererEffect: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  return node
}

/**
 * 创建测试用的 RootRuntimeNode，支持注入自定义 id、key 和 dispose scope。
 *
 * @param options - 可选覆盖参数
 */
export function createTestRootRuntimeNode(
  options: {
    id?: number
    key?: string
    scope?: RuntimeScope
  } = {}
): RootRuntimeNode {
  const root = createRootRuntimeNode({ scope: options.scope ?? createRuntimeScope() })

  return {
    ...root,
    id: options.id ?? root.id,
    key: options.key ?? root.key,
  }
}

/**
 * 创建测试用的 FieldRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestFieldRuntimeNode(options: {
  id?: number
  node: Omit<CreateFieldRuntimeNodeOptions, "id" | "scope">
  parent: ParentRuntimeNode
  scope?: RuntimeScope
}): FieldRuntimeNode {
  return createFieldRuntimeNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

/**
 * 创建测试用的 GroupRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestGroupRuntimeNode(options: {
  id?: number
  node: Omit<CreateGroupRuntimeNodeOptions, "id" | "scope">
  parent: ParentRuntimeNode
  scope?: RuntimeScope
}): GroupRuntimeNode {
  return createGroupRuntimeNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

/**
 * 创建测试用的 DependencyRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestDependencyRuntimeNode(options: {
  id?: number
  node: Omit<CreateDependencyRuntimeNodeOptions, "id" | "scope">
  parent: ParentRuntimeNode
  scope?: RuntimeScope
}): DependencyRuntimeNode {
  return createDependencyRuntimeNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}
