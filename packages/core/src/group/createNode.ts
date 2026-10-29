/**
 * Group Node 运行态工厂。
 *
 * @module core/group/createNode
 */

import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler/helper"
import { isSchemaNode } from "../node"
import { createComputed, createSignal } from "../reactivity"

import type { SchemaNodeFactoryOptions } from "../compiler"
import type { GroupNode, PresentationDependencyOverrides } from "../node"
import type { SchemxGroupField, Values } from "../types"

/**
 * 创建尚未挂载的 Group Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的身份、已编译 Group 配置和节点作用域。
 * @returns 已建立静态配置和呈现状态的 Group Node。
 *
 * @example
 * ```ts
 * const node = createGroupNode(options)
 * ```
 */
export function createGroupNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<SchemxGroupField<TValues>>
): GroupNode<TValues> {
  const { configToken, id, key, schema, scope } = options

  const compiledSchema = createSignal(schema, {
    name: `group:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<PresentationDependencyOverrides>(
    {},
    {
      name: `presentation:${id}:dependencyOverrides`,
    }
  )

  // 先建立节点身份与可变结构，派生状态只读取已经创建的节点。
  const node: Omit<GroupNode<TValues>, "presentationState"> = {
    id,
    key,
    type: "group",
    parent: null,
    scope,
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    dependencyOverrides,
    viewSchemas: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  const inheritedPresentationState = createComputed(() => {
    const parent = node.parent

    return parent && isSchemaNode(parent)
      ? parent.presentationState.value
      : DEFAULT_PRESENTATION_STATE
  })

  const presentationState = createComputed(() => {
    return resolvePresentationState(
      compiledSchema.value,
      dependencyOverrides.value,
      inheritedPresentationState.value
    )
  })

  // 完成派生状态后才将完整节点交给 Compiler。
  return Object.assign(node, {
    presentationState,
  })
}
