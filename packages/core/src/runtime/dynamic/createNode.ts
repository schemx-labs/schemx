/**
 * Dynamic Node 编译工厂。
 *
 * @module core/runtime/dynamic/createNode
 */

import { createComputed, createSignal } from "../../reactivity"
import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler"
import { createScope, isSchemaNode } from "../node"

import type { SchemxDynamicField, Values } from "../../types"
import type { SchemaNodeFactoryOptions } from "../compiler"
import type { DynamicNode, PresentationDependencyOverrides } from "../node"

/**
 * 创建尚未挂载的 Dynamic Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的节点身份、Dynamic Schema 和共享配置。
 * @returns 已建立静态配置、呈现状态和数组行状态的 Dynamic Node。
 *
 * @example
 * ```ts
 * const node = createDynamicNode(options)
 * ```
 */
export function createDynamicNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<TValues, SchemxDynamicField<TValues>>
): DynamicNode<TValues> {
  const { compilerOptions, configToken, id, key, schema, scope } = options

  const compiledSchemaValue: SchemxDynamicField<TValues> = {
    ...schema,
    key,
    visible: schema.visible ?? compilerOptions.schemaConfig.visible,
    readonly: schema.readonly ?? compilerOptions.schemaConfig.readonly,
    disabled: schema.disabled ?? compilerOptions.schemaConfig.disabled,
  }

  const compiledSchema = createSignal(compiledSchemaValue, {
    name: `dynamic:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<PresentationDependencyOverrides>(
    {},
    {
      name: `presentation:${id}:dependencyOverrides`,
    }
  )

  // 先建立节点身份与可变结构，派生状态只读取已经创建的节点。
  const node: Omit<DynamicNode<TValues>, "presentationState" | "effectiveState"> = {
    id,
    key,
    type: "dynamic",
    parent: null,
    scope: scope ?? createScope(),
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    staticSchema: compiledSchema,
    dependencyOverrides,
    dynamicOverrides: dependencyOverrides,
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
    effectiveState: presentationState,
  })
}
