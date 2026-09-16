/**
 * Group Node 编译工厂。
 *
 * @module core/runtime/group/createNode
 */

import { createComputed, createSignal } from "../../reactivity"
import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler/helper"
import { isSchemaNode } from "../node/helper"
import { createScope } from "../node/scope"

import type { SchemxGroupField, Values } from "../../types"
import type { SchemaNodeFactoryOptions } from "../compiler/types"
import type { GroupNode, PresentationDependencyOverrides } from "../node"

/**
 * 创建尚未挂载的 Group Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的节点身份、Group Schema 和共享配置。
 * @returns 已建立静态配置和呈现状态的 Group Node。
 *
 * @example
 * ```ts
 * const node = createGroupNode(options)
 * ```
 */
export function createGroupNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<TValues, SchemxGroupField<TValues>>
): GroupNode<TValues> {
  const { compilerOptions, configToken, id, key, schema, scope } = options

  const compiledSchemaValue: SchemxGroupField<TValues> = {
    ...schema,
    key,
    children: [],
    visible: schema.visible ?? compilerOptions.schemaConfig.visible,
    readonly: schema.readonly ?? compilerOptions.schemaConfig.readonly,
    disabled: schema.disabled ?? compilerOptions.schemaConfig.disabled,
  }

  const compiledSchema = createSignal(compiledSchemaValue, {
    name: `group:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<PresentationDependencyOverrides>(
    {},
    {
      name: `presentation:${id}:dependencyOverrides`,
    }
  )

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

  const node: GroupNode<TValues> = {
    id,
    key,
    type: "group",
    parent: null,
    scope: scope ?? createScope(),
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    staticSchema: compiledSchema,
    dependencyOverrides,
    dynamicOverrides: dependencyOverrides,
    presentationState,
    effectiveState: presentationState,
    viewSchemas: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  return node
}
