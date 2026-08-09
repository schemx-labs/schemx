/**
 * RuntimeNode 类型守卫与辅助函数。
 *
 * 提供一系列类型保护函数，用于在运行时区分不同种类的 RuntimeNode，
 * 以及获取节点子元素等通用操作。
 *
 * @module core/runtime/node/helper
 */

import {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  ParentRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  SchemaRuntimeNode,
} from "./types"

import type { Values } from "../../types"

/**
 * 判断 RuntimeNode 是否为 root 节点。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 RootRuntimeNode
 */
export function isRootRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is RootRuntimeNode<TValues> {
  return node.type === "root"
}

/**
 * 判断 RuntimeNode 是否为 field 节点。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 FieldRuntimeNode
 */
export function isFieldRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is FieldRuntimeNode<TValues> {
  return node.type === "field"
}

/**
 * 判断 RuntimeNode 是否为 group 节点。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 GroupRuntimeNode
 */
export function isGroupRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is GroupRuntimeNode<TValues> {
  return node.type === "group"
}

/**
 * 判断 RuntimeNode 是否为 dependency 节点。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 DependencyRuntimeNode
 */
export function isDependencyRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is DependencyRuntimeNode<TValues> {
  return node.type === "dependency"
}

/**
 * 判断 RuntimeNode 是否由 schema 创建。
 *
 * 所有非 root 节点（field、group、dependency）都由 schema 创建，
 * 并直接持有已解析的运行时配置。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 SchemaRuntimeNode
 */
export function isSchemaRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is SchemaRuntimeNode<TValues> {
  return node.type !== "root"
}

/**
 * 判断 RuntimeNode 是否可承载子节点。
 *
 * Root、Group、Dependency 节点可以承载子节点。
 * field 节点没有子节点。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要判断的 RuntimeNode
 * @returns 是否为 ParentRuntimeNode
 */
export function isParentRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is ParentRuntimeNode<TValues> {
  return node.type === "root" || node.type === "group" || node.type === "dependency"
}

/**
 * 获取 RuntimeNode 的子节点列表。
 *
 * 对可承载子节点的 RuntimeNode 返回其 childNodes signal 的当前值；
 * 对 field 节点返回空数组。
 *
 * @typeParam TValues - 表单值类型
 * @param node - RuntimeNode
 * @returns 只读的子节点数组
 */
export function getRuntimeNodeChildren<TValues extends Values>(
  node: RuntimeNode<TValues>
): readonly SchemaRuntimeNode<TValues>[] {
  return isParentRuntimeNode(node) ? node.childNodes.value : []
}
