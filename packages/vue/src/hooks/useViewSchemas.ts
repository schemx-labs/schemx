/**
 * useViewSchemas - Vue ViewSchemas bridge.
 *
 * @module hooks/useViewSchemas
 */

import { onScopeDispose, shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/**
 * 将表单 ViewSchema 映射为 Vue 响应式引用，并在当前作用域销毁时自动取消订阅。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要订阅的表单实例。
 * @returns 当前 ViewSchema 列表的只读浅引用。
 *
 * @example
 * ```ts
 * const form = useForm()
 * const viewSchemas = useViewSchemas(form)
 *
 * watchEffect(() => console.log(viewSchemas.value))
 * ```
 */
export function useViewSchemas<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): ShallowRef<readonly SchemxViewSchema<TValues>[]> {
  const viewSchemas = shallowRef<readonly SchemxViewSchema<TValues>[]>(
    form.getViewSchemas()
  )

  const unsubscribe = form.subscribeViewSchemas((nextSchemas) => {
    viewSchemas.value = nextSchemas
  })

  onScopeDispose(unsubscribe)

  return viewSchemas
}

export default useViewSchemas
