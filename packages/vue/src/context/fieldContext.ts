/**
 * 当前字段实例的 Vue provide/inject 适配。
 *
 * @module context/fieldContext
 */

import { inject, type InjectionKey, provide } from "vue"

import type { FieldInstance } from "../types/field"
import type { Values } from "@schemx/core"

const SCHEMX_FIELD_CONTEXT_KEY: InjectionKey<FieldInstance<Values>> = Symbol(
  "schemx:field"
)

/**
 * 向后代组件提供当前字段实例。
 */
export function createFieldContext<TValues extends Values = Values>(
  field: FieldInstance<TValues>
): void {
  provide<FieldInstance<Values>>(SCHEMX_FIELD_CONTEXT_KEY, field as FieldInstance<Values>)
}

/**
 * 获取最近祖先组件提供的当前字段实例。
 */
export function useFieldContext(): FieldInstance<Values> {
  const field = inject<FieldInstance<Values> | null>(SCHEMX_FIELD_CONTEXT_KEY, null)

  if (!field) {
    throw new Error(
      "[schemx] useFieldContext() must be called inside a component tree where " +
        "createFieldContext(field) has been called."
    )
  }

  return field
}
