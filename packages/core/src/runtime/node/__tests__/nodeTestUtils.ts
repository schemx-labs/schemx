/**
 * 运行时节点（Node）的测试辅助工具。
 *
 * 提供创建 RootNode、FieldNode、GroupNode 和
 * DependencyNode 的工厂函数，用于隔离测试节点结构操作。
 *
 * @module core/runtime/node/__tests__/nodeTestUtils
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

/**
 * 仅供测试创建 RootNode。
 *
 * @param options - RootNode 使用的资源作用域。
 * @returns 新的 RootNode。
 */
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

/**
 * 仅供测试创建 FieldNode。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - FieldNode 创建配置。
 * @returns 新的 FieldNode。
 */
export function createFieldNode<TValues extends Values = Values>(
  options: CreateFieldNodeOptions<TValues>
): FieldNode<TValues> {
  const signals = createFieldRuntimeSignals<TValues>({
    nodeId: options.id,
    key: options.key,
    name: options.name,
    compiledSchema: options.compiledSchema,
    inheritedPresentationState: createInheritedPresentationState(() => node),
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
    staticSchema: signals.compiledSchema,
    viewSchemas: null,
    validationEffectScope: null,
    dependenciesEffectScope: null,
  }

  return node
}

/**
 * 仅供测试创建 GroupNode。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - GroupNode 创建配置。
 * @returns 新的 GroupNode。
 */
export function createGroupNode<TValues extends Values = Values>(
  options: CreateGroupNodeOptions<TValues>
): GroupNode<TValues> {
  const compiledSchema = createSignal(options.compiledSchema)

  const signals = createPresentationRuntimeSignals({
    nodeId: options.id,
    getSchemaState: () => ({
      visible: compiledSchema.value.visible ?? true,
      readonly: compiledSchema.value.readonly ?? false,
      disabled: compiledSchema.value.disabled ?? false,
    }),
    inheritedPresentationState: createInheritedPresentationState(() => node),
  })

  const node: GroupNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "group",
    parent: null,
    scope: options.scope ?? createScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    compiledSchema,
    staticSchema: compiledSchema,
    ...signals,
    viewSchemas: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  return node
}

/**
 * 仅供测试创建 DependencyNode。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - DependencyNode 创建配置。
 * @returns 新的 DependencyNode。
 */
export function createDependencyNode<TValues extends Values = Values>(
  options: CreateDependencyNodeOptions<TValues>
): DependencyNode<TValues> {
  const compiledSchema = createSignal(options.compiledSchema)

  const signals = createPresentationRuntimeSignals({
    nodeId: options.id,
    getSchemaState: () => ({
      visible: compiledSchema.value.visible ?? true,
      readonly: compiledSchema.value.readonly ?? false,
      disabled: compiledSchema.value.disabled ?? false,
    }),
    inheritedPresentationState: createInheritedPresentationState(() => node),
  })

  const node: DependencyNode<TValues> = {
    id: options.id,
    key: options.key,
    type: "dependency",
    parent: null,
    scope: options.scope ?? createScope(),
    disposed: createSignal(false),
    configToken: options.configToken,
    compiledSchema,
    staticSchema: compiledSchema,
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
 * @param options - 可选的 id、key 和资源作用域覆盖参数。
 * @returns 配置后的 RootNode。
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
 * @param options - 必填节点配置和 parent，可选 id 和 scope。
 * @returns 配置后的 FieldNode。
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
 * @param options - 必填节点配置和 parent，可选 id 和 scope。
 * @returns 配置后的 GroupNode。
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
 * @param options - 必填节点配置和 parent，可选 id 和 scope。
 * @returns 配置后的 DependencyNode。
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
