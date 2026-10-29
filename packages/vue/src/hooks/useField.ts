/**
 * useField - 字段控制 Hook。
 *
 * 基于已桥接 Form 创建轻量字段工具，响应式读取复用 Form 的统一桥接。
 *
 * @module hooks/useField
 */

import { computed } from "vue"

import { createField } from "@schemx/core"

import { useVueFormRuntime } from "../bridge"
import { readFormContextInstance } from "../context"

import type { VueFormRuntime } from "../bridge"
import type { FieldInstance } from "../types"
import type { DeepReadonly, FieldValue, NamePath, Values } from "@schemx/core"

/**
 * 基于已桥接 Form 创建字段工具，并增加 Vue computed 接口。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param runtime - 调用方已经绑定到当前 scope 的 Runtime。
 * @param name - 当前字段路径。
 * @returns 同时提供 Core 字段操作和 Vue Ref 状态的字段控制器。
 * @example const field = createFieldHook(runtime, "name")
 */
export function createFieldHook<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(runtime: VueFormRuntime<TValues>, name: TName): FieldInstance<TValues, TName> {
  const form = runtime.instance

  const field = createField<TValues, TName>(form, name)

  const getName = (): NamePath<TValues> | undefined => form.getFieldName(field.ref)

  const getValue: FieldInstance<TValues, TName>["getValue"] = () =>
    field.getValue() as DeepReadonly<FieldValue<TValues, TName>> | undefined

  const setValue = (next: FieldInstance<TValues, TName>["value"]["value"]): void =>
    field.setValue(next as FieldValue<TValues, TName> | undefined)

  const value = computed({ get: getValue, set: setValue })

  const errors = computed(field.getErrors)

  const dirty = computed(field.isTouched)

  const pending = computed(field.isPending)

  const instance: Omit<FieldInstance<TValues, TName>, "name"> = {
    ...field,
    value,
    errors,
    dirty,
    pending,
    getValue,
  }

  // defineProperty 已建立只读路径属性，此断言仅补齐其类型层面不可见的属性。
  return Object.defineProperty(instance, "name", {
    enumerable: true,
    get: getName,
  }) as FieldInstance<TValues, TName>
}

/**
 * 获取单个字段的控制能力。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始字段路径；省略时保留旧的路径联合类型。
 * @param name - 字段路径（支持嵌套字段）。
 * @returns 包含 Vue Ref 状态和 Core 字段操作的控制器。
 *
 * @example
 * ```ts
 * const field = useField("email")
 * field.value.value = "user@example.com"
 * ```
 */
export function useField<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(name: TName): FieldInstance<TValues, TName> {
  const runtime = useVueFormRuntime(readFormContextInstance<TValues>())

  return createFieldHook(runtime, name)
}

export default useField
