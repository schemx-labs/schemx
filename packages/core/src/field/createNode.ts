/**
 * Field Node 运行态工厂。
 *
 * @module core/field/createNode
 */

import {
  createInitialDiagnostics,
  DEFAULT_PRESENTATION_STATE,
  isValidationStateEqual,
  resolveComponentProps,
  resolvePresentationState,
} from "../compiler/helper"
import { isSchemaNode } from "../node"
import { createComputed, createSignal } from "../reactivity"

import type { SchemaNodeFactoryOptions } from "../compiler"
import type { FieldDependencyOverrides, FieldNode, FieldValidationState } from "../node"
import type { SchemxBaseField, Values } from "../types"

/**
 * 创建尚未挂载的 Field Node。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler 分配的身份、已编译 Field 配置和节点作用域。
 * @returns 已建立静态、动态、有效和校验状态的 Field Node。
 *
 * @example
 * ```ts
 * const node = createFieldNode(options)
 * ```
 */
export function createFieldNode<TValues extends Values>(
  options: SchemaNodeFactoryOptions<SchemxBaseField<TValues>>
): FieldNode<TValues> {
  const { configToken, debug, id, key, schema, scope } = options

  const compiledSchema = createSignal<SchemxBaseField<TValues>>(schema, {
    name: `field:${id}:compiledSchema`,
  })

  const dependencyOverrides = createSignal<FieldDependencyOverrides<TValues>>(
    {},
    {
      name: `field:${id}:dependencyOverrides`,
    }
  )

  const diagnostics =
    debug === true
      ? createSignal(createInitialDiagnostics<TValues>(), {
          name: `field:${id}:diagnostics`,
        })
      : undefined

  const nameSignal = createSignal(schema.name, {
    name: `field:${id}:name`,
  })

  // 先建立节点身份与可变结构，派生状态只读取已经创建的节点。
  const node: Omit<FieldNode<TValues>, "resolvedSchema" | "validationState"> = {
    id,
    key,
    type: "field",
    parent: null,
    scope,
    disposed: createSignal(false),
    configToken,
    name: nameSignal,
    pathController: new AbortController(),
    rulesOverride: createSignal<SchemxBaseField<TValues>["rules"]>(undefined),
    compiledSchema,
    dependencyOverrides,
    diagnostics,
    viewSchemas: null,
    validationEffectScope: null,
    dependenciesEffectScope: null,
  }

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
      componentProps: resolveComponentProps<TValues>({
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
      onChange: compiledSchemaValue.onChange,
      onBlur: compiledSchemaValue.onBlur,
    }
  })

  // 在节点交给 Compiler 前补齐派生状态。
  const field: FieldNode<TValues> = Object.assign(node, {
    resolvedSchema,
    validationState,
  })

  // detached 节点被丢弃时也结束其路径绑定。
  field.scope.add(() => field.pathController.abort())

  return field
}
