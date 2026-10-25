/**
 * useViewSchemas - Vue ViewSchema 状态读取。
 *
 * ViewSchema 投影由 Form Runtime 统一缓存和回收；Hook 只绑定当前 scope 的
 * Runtime owner。
 *
 * @module hooks/useViewSchemas
 */

import { computed } from "vue"
import type { ComputedRef, ShallowRef } from "vue"

import { useVueFormRuntime } from "../bridge"

import type { VueFormRuntime } from "../bridge"
import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/**
 * 获取当前表单共享的 ViewSchema 列表。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要读取 ViewSchema 的表单实例。
 * @returns 当前表单的响应式 ViewSchema 列表。
 *
 * @example
 * ```ts
 * const schemas = useViewSchemas(form)
 * console.log(schemas.value)
 * ```
 */
export function useViewSchemas<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): ShallowRef<readonly SchemxViewSchema<TValues>[]> {
  const state = useVueFormRuntime(form).getViewSchemaState()

  return state.viewSchemas
}

/**
 * 获取当前 key 对应的共享 ViewSchema。
 *
 * @typeParam TValues - 表单值类型。
 * @param runtime - 调用方已经绑定到当前 scope 的 Runtime。
 * @param getKey - 返回目标 ViewSchema key 的响应式函数。
 * @returns 当前 key 对应的 ViewSchema；不存在时为 `undefined`。
 *
 * @example
 * ```ts
 * const schema = useViewSchema(runtime, () => currentKey.value)
 * ```
 */
export function useViewSchema<TValues extends Values = Values>(
  runtime: VueFormRuntime<TValues>,
  getKey: () => string
): ComputedRef<SchemxViewSchema<TValues> | undefined> {
  const state = runtime.getViewSchemaState()

  const schema = computed(() => state.schemasByKey.value.get(getKey()))

  return schema
}

export default useViewSchemas
