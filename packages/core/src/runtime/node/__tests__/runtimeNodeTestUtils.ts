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
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../../descriptor"
import type {
  ContainerRuntimeNode,
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
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
    dispose?: RuntimeDispose
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
 * @param options - 必填 key、parent、descriptor，可选 id 和 dispose
 */
export function createTestFieldRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: FieldDescriptor
  dispose?: RuntimeDispose
}): FieldRuntimeNode {
  return createFieldRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

/**
 * 创建测试用的 GroupRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填 key、parent、descriptor，可选 id 和 dispose
 */
export function createTestGroupRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: GroupDescriptor
  dispose?: RuntimeDispose
}): GroupRuntimeNode {
  return createGroupRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

/**
 * 创建测试用的 DependencyRuntimeNode，默认挂载到 parent 的 dispose scope 下。
 *
 * @param options - 必填 key、parent、descriptor，可选 id 和 dispose
 */
export function createTestDependencyRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: DependencyDescriptor
  dispose?: RuntimeDispose
}): DependencyRuntimeNode {
  return createDependencyRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}
