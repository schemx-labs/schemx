/**
 * useField - 字段控制 Hook。
 *
 * 复用共享 Vue Form Bridge 的字段 Ref，并将 Core 的字段写入、校验和规则操作
 * 保持在原始 `createField()` 实例上。
 *
 * @module hooks/useField
 */

import { computed } from "vue"

import { createField } from "@schemx/core"

import {
  getCoreForm,
  getVueFieldBridge,
  getVueFormBridge,
  type VueFieldBridge,
  type VueSchemxInstance,
} from "../formBridge"

import { useFormContext } from "./provideFormContext"

import type { FieldInstance } from "../types/field"
import type { NamePath, Values } from "@schemx/core"

/**
 * 创建一份字段控制器，并将所有读取状态投影到共享 Vue Field Bridge。
 */
function createFieldHook<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: VueSchemxInstance<TValues>,
  name: TName,
  fieldBridge: VueFieldBridge<TValues, TName>
): FieldInstance<TValues> {
  const coreForm = getCoreForm(form)

  const coreField = createField<TValues>(coreForm, name)

  const errors = computed(() => fieldBridge.errors.value)

  const dirty = computed(() => fieldBridge.touched.value)

  const pending = computed(() => fieldBridge.pending.value)

  const getValue = (): ReturnType<typeof coreField.getValue> => fieldBridge.value.value

  const getErrors = (): ReturnType<typeof coreField.getErrors> => fieldBridge.errors.value

  const isTouched = (): boolean => fieldBridge.touched.value

  const isPending = (): boolean => fieldBridge.pending.value

  const getValues = (): Readonly<TValues> => form.getFieldsValue()

  return {
    ...coreField,
    name,
    value: fieldBridge.value,
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
 * @param name - 字段路径（支持嵌套字段）。
 * @returns 包含 Vue Ref 状态和 Core 字段操作的控制器。
 */
export const useField = <TValues extends Values = Values>(
  name: NamePath<TValues>
): FieldInstance<TValues> => {
  const form = useFormContext<TValues>()

  const coreForm = getCoreForm(form)

  const formBridge = getVueFormBridge(coreForm)

  const fieldBridge = getVueFieldBridge(formBridge, name)

  return createFieldHook(form, name, fieldBridge)
}

export default useField
