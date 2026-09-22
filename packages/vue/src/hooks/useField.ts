/**
 * useField - 字段控制 Hook。
 *
 * 复用共享 Vue Runtime 的字段 Ref，并将 Core 的字段写入、校验和规则操作
 * 保持在原始 `createField()` 实例上。
 *
 * @module hooks/useField
 */

import { computed } from "vue"

import { createField } from "@schemx/core"

import { useFormContext, useFormRuntimeContext } from "../context/formContext"

import type { VueFieldState } from "../bridge"
import type { FieldInstance } from "../types/field"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

/**
 * 创建一份字段控制器，并将所有读取状态投影到共享 Vue Field State。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param form - 当前响应式表单实例。
 * @param coreForm - 用于创建 Core 字段控制器的原始 Form。
 * @param name - 当前字段路径。
 * @param fieldState - 当前字段的共享 Vue 状态。
 * @returns 同时提供 Core 字段操作和 Vue Ref 状态的字段控制器。
 */
function createFieldHook<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  coreForm: SchemxInstance<TValues>,
  name: TName,
  fieldState: VueFieldState<TValues, TName>
): FieldInstance<TValues> {
  const coreField = createField<TValues>(coreForm, name)

  const errors = computed(() => fieldState.errors.value)

  const dirty = computed(() => fieldState.touched.value)

  const pending = computed(() => fieldState.pending.value)

  const getValue = (): ReturnType<typeof coreField.getValue> => fieldState.value.value

  const getErrors = (): ReturnType<typeof coreField.getErrors> => fieldState.errors.value

  const isTouched = (): boolean => fieldState.touched.value

  const isPending = (): boolean => fieldState.pending.value

  const getValues = (): Readonly<TValues> => form.getFieldsValue()

  return {
    ...coreField,
    name,
    value: fieldState.value,
    errors,
    dirty,
    pending,
    getValue,
    getErrors,
    isTouched,
    isPending,
    getValues,
  }
}

/**
 * 获取单个字段的控制能力。
 *
 * @typeParam TValues - 表单值类型。
 * @param name - 字段路径（支持嵌套字段）。
 * @returns 包含 Vue Ref 状态和 Core 字段操作的控制器。
 *
 * @example
 * ```ts
 * const field = useField("email")
 * field.value.value = "user@example.com"
 * ```
 */
export const useField = <TValues extends Values = Values>(
  name: NamePath<TValues>
): FieldInstance<TValues> => {
  const form = useFormContext<TValues>()

  const runtime = useFormRuntimeContext<TValues>()

  const fieldState = runtime.getFieldState(name)

  return createFieldHook(form, runtime.instance, name, fieldState)
}

export default useField
