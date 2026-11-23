/**
 * useFieldContext - 通过 Vue provide/inject 获取当前字段上下文
 *
 * FormItem 通过 provideFieldContext 将 useField 创建的字段实例注入子树，
 * 渲染器通过 useFieldContext 获取，无需知道字段名。
 *
 * @module hooks/useFieldContext
 *
 * @example
 * ```typescript
 * // FormItem 中
 * const field = useField('date')
 * provideFieldContext(field)
 *
 * // 渲染器中
 * const field = useFieldContext()
 * field.error.value  // string[] | undefined
 * field.getValue()   // 当前字段值（Vue 响应式）
 * ```
 */

import { inject, type InjectionKey, provide } from "vue"

import { Values } from "@schemx/core"

import { FieldInstance } from "../types/field"

import type { useField } from "./useField"

/** 字段上下文注入 key */
const FIELD_CONTEXT_KEY: InjectionKey<FieldInstance> = Symbol("schemx:field")

/**
 * 向子组件树注入当前字段上下文。
 *
 * 应在 FormItem（或任何创建了 useField 的组件）的 setup 中调用。
 *
 * @param field - useField 返回的字段实例
 */
export function provideFieldContext<TValues extends Values = Values>(
  field: FieldInstance<TValues>
): void {
  provide(FIELD_CONTEXT_KEY, field as FieldInstance)
}

/**
 * 从最近的 FormItem 获取当前字段上下文。
 *
 * 必须在 FormItem 的组件子树内调用，否则抛出错误。
 *
 * @returns useField 返回的字段实例
 *
 * @throws 当不在 FormItem 子树内时抛出
 */
export function useFieldContext(): ReturnType<typeof useField> {
  const field = inject(FIELD_CONTEXT_KEY)

  if (!field) {
    throw new Error("[schemx] useFieldContext() must be used inside a FormItem tree")
  }

  return field
}
