/**
 * useViewSchemas - Vue ViewSchema 状态读取。
 *
 * ViewSchema 投影由 Form Runtime 统一缓存和回收；Hook 只绑定当前 scope 的
 * Runtime owner。
 *
 * @module hooks/useViewSchemas
 */

import { computed, onScopeDispose } from "vue"
import type { ComputedRef, ShallowRef } from "vue"

import { acquireVueFormRuntime } from "../bridge"

import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/** 获取当前表单共享的 ViewSchema 列表。 */
export function useViewSchemas<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): ShallowRef<readonly SchemxViewSchema<TValues>[]> {
  const acquired = acquireVueFormRuntime(form)

  const state = acquired.runtime.getViewSchemaState()

  onScopeDispose(acquired.release)

  return state.viewSchemas
}

/** 获取当前 key 对应的共享 ViewSchema。 */
export function useViewSchema<TValues extends Values = Values>(
  form: SchemxInstance<TValues>,
  getKey: () => string
): ComputedRef<SchemxViewSchema<TValues> | undefined> {
  const acquired = acquireVueFormRuntime(form)

  const state = acquired.runtime.getViewSchemaState()

  const schema = computed(() => state.schemasByKey.value.get(getKey()))

  onScopeDispose(acquired.release)

  return schema
}

export default useViewSchemas
