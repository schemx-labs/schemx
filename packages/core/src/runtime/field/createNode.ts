/**
 * Field Node 编译工厂。
 *
 * @module core/runtime/field/createNode
 */

import { createComputed, createSignal } from "../../reactivity"
import {
  compileFieldSchema,
  createInitialDiagnostics,
  DEFAULT_PRESENTATION_STATE,
  isValidationStateEqual,
  resolveComponentProps,
  resolvePresentationState,
} from "../compiler/helper"
import { isSchemaNode } from "../node/helper"
import { createScope } from "../node/scope"

import type { SchemxBaseField, Values } from "../../types"
import type { SchemaNodeFactoryOptions } from "../compiler/types"
import type { FieldDependencyOverrides, FieldNode, FieldValidationState } from "../node"

/**
 * 创建尚未挂载的 Field Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的节点身份、Field Schema 和共享配置。
 * @returns 已建立静态、动态、有效和校验状态的 Field Node。
 *
 * @example
 * ```ts
 * const node = createFieldNode(options)
 * ```
 */
export function createFieldNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<TValues, SchemxBaseField<TValues>>
): FieldNode<TValues> {
  const { compilerOptions, configToken, id, key, schema, scope } = options

  const compiledSchemaValue = compileFieldSchema(schema, key, compilerOptions)

  const compiledSchema = createSignal<SchemxBaseField<TValues>>(
    {
      ...compiledSchemaValue,
      dependencies: schema.dependencies,
    },
    {
      name: `field:${id}:compiledSchema`,
    }
  )

  const dependencyOverrides = createSignal<FieldDependencyOverrides<TValues>>(
    {},
    {
      name: `field:${id}:dependencyOverrides`,
    }
  )

  const diagnostics =
    compilerOptions.debug === true
      ? createSignal(createInitialDiagnostics<TValues>(), {
          name: `field:${id}:diagnostics`,
        })
      : undefined

  const nameSignal = createSignal(schema.name, {
    name: `field:${id}:name`,
  })

  const inheritedPresentationState = createComputed(() => {
    const parent = node.parent

    return parent && isSchemaNode(parent)
      ? parent.presentationState.value
      : DEFAULT_PRESENTATION_STATE
  })

  let previousValidationState: FieldValidationState<TValues> | undefined

  const validationState = createComputed(() => {
    const compiledSchemaValue = compiledSchema.value

    const dependencyOverridesValue = dependencyOverrides.value

    const presentationState = resolvePresentationState(
      compiledSchemaValue,
      dependencyOverridesValue,
      inheritedPresentationState.value
    )

    const nextValidationState: FieldValidationState<TValues> = {
      visible: presentationState.visible,
      disabled: presentationState.disabled,
      readonly: presentationState.readonly,
      label: compiledSchemaValue.label || "",
      required:
        dependencyOverridesValue.required ?? compiledSchemaValue.required ?? false,
      rules: dependencyOverridesValue.rules ?? compiledSchemaValue.rules ?? [],
    }

    if (
      previousValidationState &&
      isValidationStateEqual(previousValidationState, nextValidationState)
    ) {
      return previousValidationState
    }

    previousValidationState = nextValidationState

    return nextValidationState
  })

  const resolvedSchema = createComputed(() => {
    const compiledSchemaValue = compiledSchema.value

    const dependencyOverridesValue = dependencyOverrides.value

    const validationStateValue = validationState.value

    const readonlyPlaceholder =
      dependencyOverridesValue.readonlyPlaceholder ??
      compiledSchemaValue.readonlyPlaceholder

    const placeholder =
      dependencyOverridesValue.placeholder ?? compiledSchemaValue.placeholder ?? ""

    const showRequiredMark =
      dependencyOverridesValue.showRequiredMark ??
      compiledSchemaValue.showRequiredMark ??
      Boolean(validationStateValue.required)

    return {
      key,
      name: nameSignal.value,
      componentType: compiledSchemaValue.componentType,
      label: validationStateValue.label,
      visible: validationStateValue.visible,
      disabled: validationStateValue.disabled,
      readonly: validationStateValue.readonly,
      required: validationStateValue.required,
      showRequiredMark,
      placeholder,
      readonlyPlaceholder,
      componentProps: resolveComponentProps({
        compiledProps: compiledSchemaValue.componentProps,
        dependencyComponentProps: dependencyOverridesValue.componentProps,
        resolvedStateProps: {
          disabled: validationStateValue.disabled,
          readonly: validationStateValue.readonly,
          placeholder,
          readonlyPlaceholder,
        },
        compiledStateProps: {
          disabled: compiledSchemaValue.disabled ?? false,
          readonly: compiledSchemaValue.readonly ?? false,
          placeholder: compiledSchemaValue.placeholder ?? "",
          readonlyPlaceholder: compiledSchemaValue.readonlyPlaceholder,
        },
      }),
      rules: validationStateValue.rules,
      validationTrigger: compiledSchemaValue.validationTrigger,
    }
  })

  const node: FieldNode<TValues> = {
    id,
    key,
    type: "field",
    parent: null,
    scope: scope ?? createScope(),
    disposed: createSignal(false),
    configToken,
    name: nameSignal,
    compiledSchema,
    staticSchema: compiledSchema,
    dependencyOverrides,
    dynamicOverrides: dependencyOverrides,
    resolvedSchema,
    effectiveSchema: resolvedSchema,
    validationState,
    validationSchema: validationState,
    diagnostics,
    viewSchemas: null,
    validationEffectScope: null,
    dependenciesEffectScope: null,
  }

  return node
}
