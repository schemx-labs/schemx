/**
 * 将 Core ViewSchema 列表投影为共享的 Vue 状态。
 *
 * @module vue/bridge/viewSchemaBridge
 */

import { computed, shallowRef } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import type { VueViewSchemaState } from "./types"
import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/**
 * 创建一个 Form 的共享 ViewSchema 状态。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要订阅 ViewSchema 的 Core Form。
 * @returns 当前 Form 的 ViewSchema 列表、索引和释放方法。
 *
 * @example
 * ```ts
 * const state = createVueViewSchemaState(form)
 * const current = state.viewSchemas.value
 * state.dispose()
 * ```
 */
export function createVueViewSchemaState<TValues extends Values>(
  form: SchemxInstance<TValues>
): VueViewSchemaState<TValues> {
  const viewSchemas = shallowRef<readonly SchemxViewSchema<TValues>[]>(
    form.getViewSchemas()
  )

  const schemasByKey = computed<ReadonlyMap<string, SchemxViewSchema<TValues>>>(() => {
    return createViewSchemaIndex(viewSchemas.value)
  })

  const unsubscribe = form.subscribeViewSchemas((nextSchemas) => {
    viewSchemas.value = nextSchemas
  })

  let disposed = false

  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    unsubscribe()
  }

  return {
    schemasByKey,
    viewSchemas,
    dispose,
  }
}

/**
 * 递归索引顶层和分组内的 ViewSchema。
 *
 * @param viewSchemas - 待索引的 ViewSchema 列表。
 * @returns 按 key 建立的 ViewSchema 索引。
 */
function createViewSchemaIndex<TValues extends Values>(
  viewSchemas: readonly SchemxViewSchema<TValues>[]
): ReadonlyMap<string, SchemxViewSchema<TValues>> {
  const schemasByKey = new Map<string, SchemxViewSchema<TValues>>()

  /**
   * 递归写入当前层级及其嵌套子节点的 ViewSchema 索引。
   *
   * @param schemas - 当前层级的 ViewSchema 列表。
   */
  const appendSchemas = (schemas: readonly SchemxViewSchema<TValues>[]): void => {
    for (const schema of schemas) {
      schemasByKey.set(schema.key, schema)

      if (isViewGroupSchema(schema)) {
        appendSchemas(schema.children)
      } else if (isViewDynamicSchema(schema)) {
        for (const item of schema.items) {
          appendSchemas(item.children)
        }
      }
    }
  }

  appendSchemas(viewSchemas)

  return schemasByKey
}
