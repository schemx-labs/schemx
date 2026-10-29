/**
 * Dependency Node 运行态工厂。
 *
 * @module core/dependencies/createNode
 */

import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler/helper"
import { isSchemaNode } from "../node"
import { createComputed, createSignal } from "../reactivity"

import type { SchemaNodeFactoryOptions } from "../compiler"
import type {
  DependencyNode,
  DynamicRowState,
  PresentationDependencyOverrides,
} from "../node"
import type { SchemxDependencyField, Values } from "../types"

/**
 * Dependency 工厂接收的已编译配置与行上下文。
 * @typeParam TValues - 表单值类型。
 */
export interface DependencyNodeFactoryOptions<
  TValues extends Values,
> extends SchemaNodeFactoryOptions<SchemxDependencyField<TValues>> {
  /**
   * 数组行内 renderer 的身份和位置快照，普通 Dependency 不设置。
   */
  readonly dynamicRow?: DynamicRowState
}

/**
 * 创建尚未挂载的 Dependency Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的身份、已编译配置、行上下文和节点作用域。
 * @returns 已建立静态配置、呈现状态和 renderer 上下文的 Dependency Node。
 *
 * @example
 * ```ts
 * const node = createDependencyNode(options)
 * ```
 */
export function createDependencyNode<TValues extends Values>(
  options: DependencyNodeFactoryOptions<TValues>
): DependencyNode<TValues> {
  const { configToken, dynamicRow, id, key, schema, scope } = options

  const compiledSchema = createSignal(schema, {
    name: `dependency:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<PresentationDependencyOverrides>(
    {},
    {
      name: `presentation:${id}:dependencyOverrides`,
    }
  )

  // 先建立节点身份与可变结构，派生状态只读取已经创建的节点。
  const node: Omit<DependencyNode<TValues>, "presentationState"> = {
    id,
    key,
    type: "dependency",
    parent: null,
    scope,
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    dynamicRow,
    dependencyOverrides,
    viewSchemas: null,
    rendererEffect: null,
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
