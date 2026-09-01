/**
 * 运行时节点（Node）的测试辅助工具。
 *
 * 提供创建 RootNode、FieldNode、GroupNode 和
 * DependencyNode 的工厂函数，用于隔离测试节点结构操作。
 *
 * @module core/runtime/node/__tests__/runtimeNodeTestUtils
 */
import { createSignal } from "../../../reactivity"
import { createScope } from "../scope"

import {
  createFieldRuntimeSignals,
  createInheritedPresentationState,
  createPresentationRuntimeSignals,
} from "./signalsTestUtils"

import type { Values } from "../../../types"
import type {
  CreateDependencyNodeOptions,
  CreateFieldNodeOptions,
  CreateGroupNodeOptions,
  DependencyNode,
  FieldNode,
  GroupNode,
  ParentNode,
  RootNode,
  Scope,
} from "../types"

/** 仅供测试创建 RootNode。 */
export function createRootNode(options: { scope: Scope }): RootNode {
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

/** 仅供测试创建 FieldNode。 */
export function createFieldNode<TValues extends Values = Values>(
  options: CreateFieldNodeOptions<TValues>
): FieldNode<TValues> {
  const signals = createFieldRuntimeSignals<TValues>({
    nodeId: options.id,
    key: options.key,
    name: options.name,
    staticSchema: options.staticSchema,
    inheritedState: createInheritedPresentationState(() => node),
    debug: options.debug,
  })

  const node: FieldNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "field",
    parent: null,
    scope: options.scope ?? createScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    ...signals,
    viewSchemas: null,
    validationEffectScope: null,
    dependenciesEffectScope: null,
  }

  return node
}

/** 仅供测试创建 GroupNode。 */
export function createGroupNode<TValues extends Values = Values>(
  options: CreateGroupNodeOptions<TValues>
): GroupNode<TValues> {
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

  const node: GroupNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "group",
    parent: null,
    scope: options.scope ?? createScope(),
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

/** 仅供测试创建 DependencyNode。 */
export function createDependencyNode<TValues extends Values = Values>(
  options: CreateDependencyNodeOptions<TValues>
): DependencyNode<TValues> {
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

  const node: DependencyNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "dependency",
    parent: null,
    scope: options.scope ?? createScope(),
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
 * 创建测试用的 RootNode，支持注入自定义 id、key 和 dispose scope。
 *
 * @param options - 可选覆盖参数
 */
export function createTestRootNode(
  options: {
    id?: number
    key?: string
    scope?: Scope
  } = {}
): RootNode {
  const root = createRootNode({ scope: options.scope ?? createScope() })

  return {
    ...root,
    id: options.id ?? root.id,
    key: options.key ?? root.key,
  }
}

/**
 * 创建测试用的 FieldNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestFieldNode(options: {
  id?: number
  node: Omit<CreateFieldNodeOptions, "id" | "scope">
  parent: ParentNode
  scope?: Scope
}): FieldNode {
  return createFieldNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

/**
 * 创建测试用的 GroupNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestGroupNode(options: {
  id?: number
  node: Omit<CreateGroupNodeOptions, "id" | "scope">
  parent: ParentNode
  scope?: Scope
}): GroupNode {
  return createGroupNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

/**
 * 创建测试用的 DependencyNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填节点配置和 parent，可选 id 和 scope
 */
export function createTestDependencyNode(options: {
  id?: number
  node: Omit<CreateDependencyNodeOptions, "id" | "scope">
  parent: ParentNode
  scope?: Scope
}): DependencyNode {
  return createDependencyNode({
    id: options.id ?? 1,
    ...options.node,
    scope: options.scope ?? options.parent.scope.child(),
  })
}
