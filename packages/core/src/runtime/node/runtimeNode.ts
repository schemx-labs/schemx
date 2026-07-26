/**
 * RuntimeNode 结构实现。
 *
 * RuntimeNode 只表达稳定身份、节点类型、父子结构和生命周期状态。
 * described node 持有当前 descriptor，其他领域资源暂由 RuntimeNodeResources 承载。
 *
 * @module core/runtime/node/runtimeNode
 */

import { createSignal } from "../../reactivity"

import { createScope } from "./scope"

import type {
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
} from "./types"
import type { Values } from "../../types"

/**
 * 创建 RootRuntimeNode（透明根节点）。
 *
 * Root 不对应任何 schema，只负责承载顶层 children。其 id 固定为 0，
 * key 固定为 "schemx:root"，parent 始终为 null。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 创建选项，需提供 dispose scope
 * @returns 根节点实例
 */
export function createRootRuntimeNode<TValues extends Values = Values>(
  options: CreateRootRuntimeNodeOptions
): RootRuntimeNode<TValues> {
  return {
    id: 0,
    key: "schemx:root",
    type: "root",
    parent: null,
    dispose: options.dispose,
    mounted: createSignal(false),
    disposed: createSignal(false),
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
    viewState: null,
  }
}

/**
 * 创建 FieldRuntimeNode（字段节点）。
 *
 * Field 不承载结构子节点。创建时 descriptor 为 null，由后续挂载流程填充。
 * 未指定 dispose 时自动从父节点继承子 scope，确保节点生命周期随父节点管理。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 创建选项，需提供 id 和 key
 * @returns 字段节点实例
 */
export function createFieldRuntimeNode<TValues extends Values = Values>(
  options: CreateFieldRuntimeNodeOptions<TValues>
): FieldRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "field",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    fieldState: null,
    viewState: null,
    effectDispose: null,
  }
}

/**
 * 创建 GroupRuntimeNode（分组节点）。
 *
 * Group 负责 schema 结构嵌套，承载静态编译后的子节点。
 * 创建时 descriptor 为 null，childNodes 为空数组，后续通过 runtimeNodeManager 维护。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 创建选项，需提供 id 和 key
 * @returns 分组节点实例
 */
export function createGroupRuntimeNode<TValues extends Values = Values>(
  options: CreateGroupRuntimeNodeOptions<TValues>
): GroupRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "group",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    viewState: null,
    containerState: null,
    containerEffectDispose: null,
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
  }
}

/**
 * 创建 DependencyRuntimeNode（动态 dependency 节点）。
 *
 * Dependency 的 children 来自 renderer 动态产物，在挂载后由 dependency effect 填充。
 * 创建时 descriptor、effectState、dependencyDispose 均为 null。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 创建选项，需提供 id 和 key
 * @returns dependency 节点实例
 */
export function createDependencyRuntimeNode<TValues extends Values = Values>(
  options: CreateDependencyRuntimeNodeOptions<TValues>
): DependencyRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "dependency",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    viewState: null,
    effectState: null,
    dependencyDispose: null,
    containerState: null,
    containerEffectDispose: null,
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
  }
}
