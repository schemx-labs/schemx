/**
 * Node 类型守卫与辅助函数。
 *
 * 提供一系列类型保护函数，用于在运行时区分不同种类的 Node，
 * 以及获取节点子元素等通用操作。
 *
 * @module core/runtime/node/helper
 */

import { createFieldKey } from "../../utils/path"

import {
  ContainerNode,
  DependencyNode,
  DynamicNode,
  FieldNode,
  FieldRuntimeDiagnostics,
  GroupNode,
  ParentNode,
  RootNode,
  SchemaNode,
} from "./types"

import type { NamePath, Values } from "../../types"

/**
 * 字段 diagnostics 的部分更新内容，不包含由 helper 自动递增的版本号。
 *
 * @typeParam TValues - 表单值类型。
 */
type FieldDiagnosticsPatch<TValues extends Values> = Omit<
  FieldRuntimeDiagnostics<TValues>,
  "version"
>

/**
 * 合并字段运行时 diagnostics，并递增诊断版本。
 *
 * 没有开启 debug diagnostics 的节点会被直接跳过。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要更新 diagnostics 的字段节点。
 * @param patch - 本次要覆盖的诊断内容。
 */
export function updateFieldDiagnostics<TValues extends Values>(
  node: FieldNode<TValues>,
  patch: FieldDiagnosticsPatch<TValues>
): void {
  const diagnostics = node.diagnostics

  if (!diagnostics) {
    return
  }

  const previous = diagnostics.peek()

  diagnostics.value = {
    ...previous,
    ...patch,
    version: previous.version + 1,
  }
}

/**
 * 判断 Node 是否为 root 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 RootNode。
 */
export function isRootNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is RootNode<TValues> {
  return node?.type === "root"
}

/**
 * 判断 Node 是否为 field 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 FieldNode。
 */
export function isFieldNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is FieldNode<TValues> {
  return node?.type === "field"
}

/**
 * 判断 Node 是否为 group 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 GroupNode。
 */
export function isGroupNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is GroupNode<TValues> {
  return node?.type === "group"
}

/**
 * 判断 Node 是否为 dependency 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 DependencyNode。
 */
export function isDependencyNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is DependencyNode<TValues> {
  return node?.type === "dependency"
}

/**
 * 判断 Node 是否为 Dynamic 数组节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 DynamicNode。
 */
export function isDynamicNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is DynamicNode<TValues> {
  return node?.type === "dynamic"
}

/**
 * 判断 Node 是否由 schema 创建。
 *
 * 所有非 root 节点（field、group、dependency、dynamic）都由 schema 创建，
 * 并直接持有已解析的运行时配置。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 SchemaNode。
 */
export function isSchemaNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is SchemaNode<TValues> {
  return node != null && node.type !== "root"
}

/**
 * 判断 Node 是否可承载子节点。
 *
 * Root、Group、Dependency、Dynamic 节点可以承载子节点。
 * field 节点没有子节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 Node。
 * @returns 是否为 ParentNode。
 */
export function isParentNode<TValues extends Values>(
  node: ContainerNode<TValues> | null | undefined
): node is ParentNode<TValues> {
  return (
    node?.type === "root" ||
    node?.type === "group" ||
    node?.type === "dependency" ||
    node?.type === "dynamic"
  )
}

/**
 * 获取 Node 的子节点列表。
 *
 * 对可承载子节点的 Node 返回其 childNodes signal 的当前值；
 * 对 field 节点返回空数组。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要读取子节点的 Node。
 * @returns 只读的子节点数组。
 */
export function getNodeChildren<TValues extends Values>(
  node: ContainerNode<TValues>
): readonly SchemaNode<TValues>[] {
  return isParentNode(node) ? node.childNodes.value : []
}

/**
 * 从 Node 子树查找指定字段路径的字段节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param root - 查找开始的 Node，通常为 root 节点。
 * @param name - 要查找的字段路径。
 * @returns 匹配的字段节点；找不到时返回 `undefined`。
 *
 * @example
 * ```ts
 * const field = findFieldNode(root, "email")
 * ```
 */
export function findFieldNode<TValues extends Values>(
  root: ContainerNode<TValues>,
  name: NamePath<TValues>
): FieldNode<TValues> | undefined {
  const fieldKey = createFieldKey(name)

  // 按层级查找，保留同一路径优先匹配较浅节点的顺序。
  const queue: ContainerNode<TValues>[] = [root]

  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index]

    if (!node) {
      continue
    }

    if (isFieldNode(node) && createFieldKey(node.name.value) === fieldKey) {
      return node
    }

    queue.push(...getNodeChildren(node))
  }

  return undefined
}
