/**
 * 将 Core ViewSchema 列表投影为共享的 Vue 状态。
 *
 * @module vue/bridge/viewSchemaBridge
 */

import { computed, shallowRef } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import type { VueViewSchemaState } from "./types"
import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/** 创建一个 Form 的共享 ViewSchema 状态。 */
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

/** 递归索引顶层和分组内的 ViewSchema。 */
function createViewSchemaIndex<TValues extends Values>(
  viewSchemas: readonly SchemxViewSchema<TValues>[]
): ReadonlyMap<string, SchemxViewSchema<TValues>> {
  const schemasByKey = new Map<string, SchemxViewSchema<TValues>>()

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
