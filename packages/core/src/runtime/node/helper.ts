/**
 * RuntimeNode 类型守卫与辅助函数。
 *
 * 提供一系列类型保护函数，用于在运行时区分不同种类的 RuntimeNode，
 * 以及获取节点子元素等通用操作。
 *
 * @module core/runtime/node/helper
 */

import { findNodeBFS } from "../../utils/find"
import { createFieldKey } from "../../utils/path"

import {
  DependencyRuntimeNode,
  FieldRuntimeDiagnostics,
  FieldRuntimeNode,
  GroupRuntimeNode,
  ParentRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  SchemaRuntimeNode,
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
  node: FieldRuntimeNode<TValues>,
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
 * 判断 RuntimeNode 是否为 root 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 RootRuntimeNode。
 */
export function isRootRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is RootRuntimeNode<TValues> {
  return node.type === "root"
}

/**
 * 判断 RuntimeNode 是否为 field 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 FieldRuntimeNode。
 */
export function isFieldRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is FieldRuntimeNode<TValues> {
  return node.type === "field"
}

/**
 * 判断 RuntimeNode 是否为 group 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 GroupRuntimeNode。
 */
export function isGroupRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is GroupRuntimeNode<TValues> {
  return node.type === "group"
}

/**
 * 判断 RuntimeNode 是否为 dependency 节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 DependencyRuntimeNode。
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
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 SchemaRuntimeNode。
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
 * @typeParam TValues - 表单值类型。
 * @param node - 要判断的 RuntimeNode。
 * @returns 是否为 ParentRuntimeNode。
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
 * @typeParam TValues - 表单值类型。
 * @param node - 要读取子节点的 RuntimeNode。
 * @returns 只读的子节点数组。
 */
export function getRuntimeNodeChildren<TValues extends Values>(
  node: RuntimeNode<TValues>
): readonly SchemaRuntimeNode<TValues>[] {
  return isParentRuntimeNode(node) ? node.childNodes.value : []
}

/**
 * 从 RuntimeNode 子树查找指定字段路径的字段节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param root - 查找开始的 RuntimeNode，通常为 root 节点。
 * @param name - 要查找的字段路径。
 * @returns 匹配的字段节点；找不到时返回 `undefined`。
 *
 * @example
 * ```ts
 * const field = findFieldRuntimeNode(root, "email")
 * ```
 */
export function findFieldRuntimeNode<TValues extends Values>(
  root: RuntimeNode<TValues>,
  name: NamePath<TValues>
): FieldRuntimeNode<TValues> | undefined {
  const fieldKey = createFieldKey(name)

  const node = findNodeBFS(
    root,
    (current) =>
      isFieldRuntimeNode(current) && createFieldKey(current.name.value) === fieldKey,
    { getChildren: getRuntimeNodeChildren }
  )

  if (node && isFieldRuntimeNode(node)) {
    return node
  }

  return undefined
}

/**
 * 从 RuntimeNode 子树收集字段路径到 FieldRuntimeNode 的临时映射。
 *
 * 同一路径后出现的字段会覆盖先出现的字段；正常 Runtime 树不应出现重复字段路径。
 *
 * @typeParam TValues - 表单值类型。
 * @param root - 收集开始的 RuntimeNode。
 * @returns 以字段路径 key 为键的字段节点映射。
 *
 * @example
 * ```ts
 * const fieldsByName = collectFieldRuntimeNodes(root)
 * ```
 */
export function collectFieldRuntimeNodes<TValues extends Values>(
  root: RuntimeNode<TValues>
): Map<string, FieldRuntimeNode<TValues>> {
  const fieldsByName = new Map<string, FieldRuntimeNode<TValues>>()

  const visit = (node: RuntimeNode<TValues>): void => {
    if (isFieldRuntimeNode(node)) {
      fieldsByName.set(createFieldKey(node.name.value), node)

      return
    }

    for (const child of node.childNodes.value) {
      visit(child)
    }
  }

  visit(root)

  return fieldsByName
}
