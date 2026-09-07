import { inject, type InjectionKey, provide } from "vue"

import type { FieldInstance } from "../types/field"
import type { Values } from "@schemx/core"

/** 当前字段实例在 Vue provide/inject 中使用的注入 key。 */
const SCHEMX_FORM_FIELD_KEY: InjectionKey<FieldInstance> = Symbol(
  "schemx:field"
) as InjectionKey<FieldInstance<Values>>

/**
 * 向后代组件提供当前字段实例。
 *
 * 应在创建字段实例的组件 setup() 同步阶段调用，通常由 Field
 * 在调用 useField() 后使用，使字段插槽或自定义子组件能够读取同一实例。
 *
 * @param field - useField() 返回的字段实例
 *
 * @remarks
 * 该函数只注册字段上下文，不创建字段实例，也不负责字段实例的生命周期。
 *
 * @example
 * ```typescript
 * // Field 中
 * const field = useField('date')
 * createFieldContext(field)
 *
 * ```
 */
export function createFieldContext<TValues extends Values = Values>(
  field: FieldInstance<TValues>
): void {
  provide<FieldInstance<TValues>>(SCHEMX_FORM_FIELD_KEY, field)
}

/**
 * 获取最近祖先组件提供的当前字段实例。
 *
 * 必须在已调用 createFieldContext() 的组件子树内调用，否则抛出错误。
 *
 * @returns useField() 返回的字段实例
 *
 * @throws Error 当前组件不在字段上下文的后代组件树中时抛出
 *
 * @example
 * ```ts
 * const field = useFieldContext()
 * field.errors.value // readonly string[]
 * field.getValue() // 当前字段值
 * ```
 */
export function useFieldContext(): FieldInstance<Values> {
  const field = inject<FieldInstance<Values>>(SCHEMX_FORM_FIELD_KEY)

  if (!field) {
    throw new Error(
      "[schemx] useFieldContext() must be called inside a component tree where " +
        "createFieldContext(field) has been called."
    )
  }

  return field
}
