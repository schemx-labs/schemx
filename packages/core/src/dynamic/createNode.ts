/**
 * Dynamic Node 运行态工厂。
 *
 * @module core/dynamic/createNode
 */

import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler/helper"
import { isSchemaNode } from "../node"
import { createComputed, createSignal } from "../reactivity"

import type { SchemaNodeFactoryOptions } from "../compiler"
import type { DynamicNode, PresentationDependencyOverrides } from "../node"
import type { SchemxDynamicField, Values } from "../types"

/**
 * 创建尚未挂载的 Dynamic Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的身份、已编译 Dynamic 配置和节点作用域。
 * @returns 已建立静态配置、呈现状态和数组行状态的 Dynamic Node。
 *
 * @example
 * ```ts
 * const node = createDynamicNode(options)
 * ```
 */
export function createDynamicNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<SchemxDynamicField<TValues>>
): DynamicNode<TValues> {
  const { configToken, id, key, schema, scope } = options

  const compiledSchema = createSignal(schema, {
    name: `dynamic:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<PresentationDependencyOverrides>(
    {},
    {
      name: `presentation:${id}:dependencyOverrides`,
    }
  )

  // 先建立节点身份与可变结构，派生状态只读取已经创建的节点。
  const node: Omit<DynamicNode<TValues>, "presentationState"> = {
    id,
    key,
    type: "dynamic",
    parent: null,
    scope,
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    dependencyOverrides,
    presentationEffectScope: null,
    dynamicEffectScope: null,
    dynamicRows: createSignal([]),
    viewSchemas: null,
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
