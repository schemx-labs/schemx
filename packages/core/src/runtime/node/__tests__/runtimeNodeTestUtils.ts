/**
 * 运行时节点（RuntimeNode）的测试辅助工具。
 *
 * 提供创建 RootRuntimeNode、FieldRuntimeNode、GroupRuntimeNode 和
 * DependencyRuntimeNode 的工厂函数，用于隔离测试节点结构操作。
 *
 * @module core/runtime/node/__tests__/runtimeNodeTestUtils
 */
import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../runtimeNode"
import { createScope } from "../scope"

import type {
  DependencyRuntimeNodeInput,
  FieldRuntimeNodeInput,
  GroupRuntimeNodeInput,
} from "../input"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  ParentRuntimeNode,
  RootRuntimeNode,
  Scope,
} from "../types"

/**
 * 创建测试用的 RootRuntimeNode，支持注入自定义 id、key 和 dispose scope。
 *
 * @param options - 可选覆盖参数
 */
export function createTestRootRuntimeNode(
  options: {
    id?: number
    key?: string
    dispose?: Scope
  } = {}
): RootRuntimeNode {
  const root = createRootRuntimeNode({ dispose: options.dispose ?? createScope() })

  return {
    ...root,
    id: options.id ?? root.id,
    key: options.key ?? root.key,
  }
}

/**
 * 创建测试用的 FieldRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填 input、parent，可选 id 和 dispose
 */
export function createTestFieldRuntimeNode(options: {
  id?: number
  input: FieldRuntimeNodeInput
  parent: ParentRuntimeNode
  dispose?: Scope
}): FieldRuntimeNode {
  return createFieldRuntimeNode({
    id: options.id ?? 1,
    input: options.input,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

/**
 * 创建测试用的 GroupRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填 input、parent，可选 id 和 dispose
 */
export function createTestGroupRuntimeNode(options: {
  id?: number
  input: GroupRuntimeNodeInput
  parent: ParentRuntimeNode
  dispose?: Scope
}): GroupRuntimeNode {
  return createGroupRuntimeNode({
    id: options.id ?? 1,
    input: options.input,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

/**
 * 创建测试用的 DependencyRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填 input、parent，可选 id 和 dispose
 */
export function createTestDependencyRuntimeNode(options: {
  id?: number
  input: DependencyRuntimeNodeInput
  parent: ParentRuntimeNode
  dispose?: Scope
}): DependencyRuntimeNode {
  return createDependencyRuntimeNode({
    id: options.id ?? 1,
    input: options.input,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}
