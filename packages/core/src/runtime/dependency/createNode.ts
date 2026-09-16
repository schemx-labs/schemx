/**
 * Dependency Node 编译工厂。
 *
 * @module core/runtime/dependency/createNode
 */

import { createComputed, createSignal } from "../../reactivity"
import { DEFAULT_PRESENTATION_STATE, resolvePresentationState } from "../compiler/helper"
import { isSchemaNode } from "../node/helper"
import { createScope } from "../node/scope"

import type { SchemxDependencyField, Values } from "../../types"
import type { SchemaNodeFactoryOptions } from "../compiler/types"
import type { DependencyNode, PresentationDependencyOverrides } from "../node"

/**
 * 创建尚未挂载的 Dependency Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的节点身份、Dependency Schema 和共享配置。
 * @returns 已建立静态配置、呈现状态和 renderer 上下文的 Dependency Node。
 *
 * @example
 * ```ts
 * const node = createDependencyNode(options)
 * ```
 */
export function createDependencyNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<TValues, SchemxDependencyField<TValues>>
): DependencyNode<TValues> {
  const { compilerOptions, configToken, id, key, schema, scope } = options

  const compiledSchemaValue: SchemxDependencyField<TValues> = {
    ...schema,
    key,
    visible: schema.visible ?? compilerOptions.schemaConfig.visible,
    readonly: schema.readonly ?? compilerOptions.schemaConfig.readonly,
    disabled: schema.disabled ?? compilerOptions.schemaConfig.disabled,
  }

  const compiledSchema = createSignal(compiledSchemaValue, {
    name: `dependency:${id}:compiledSchema`,
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

  const node: DependencyNode<TValues> = {
    id,
    key,
    type: "dependency",
    parent: null,
    scope: scope ?? createScope(),
    disposed: createSignal(false),
    configToken,
    compiledSchema,
    staticSchema: compiledSchema,
    rendererContextKey: readDynamicDependencyContextKey(schema),
    dependencyOverrides,
    dynamicOverrides: dependencyOverrides,
    presentationState,
    effectiveState: presentationState,
    viewSchemas: null,
    rendererEffect: null,
    presentationEffectScope: null,
    childNodes: createSignal([]),
  }

  return node
}

/**
 * 读取 Dynamic 行内 Dependency 的内部上下文 token。
 *
 * @param schema - 可能携带非枚举上下文 token 的 Dependency Schema。
 * @returns 当前行上下文 token；普通 Dependency 返回 `undefined`。
 */
function readDynamicDependencyContextKey<TValues extends Values>(
  schema: SchemxDependencyField<TValues>
): string | undefined {
  const value = Reflect.get(schema, Symbol.for("schemx.dynamicDependencyContext"))

  return typeof value === "string" ? value : undefined
}
