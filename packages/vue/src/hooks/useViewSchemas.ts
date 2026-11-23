/**
 * useViewSchemas - Vue ViewSchemas bridge.
 *
 * @module hooks/useViewSchemas
 */

import { onScopeDispose, shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

export function useViewSchemas<T extends Values = Values>(
  form: SchemxInstance<T>
): ShallowRef<readonly SchemxViewSchema<T>[]> {
  const viewSchemas = shallowRef<readonly SchemxViewSchema<T>[]>(form.getViewSchemas())

  const unsubscribe = form.subscribeViewSchemas((nextSchemas) => {
    viewSchemas.value = nextSchemas
  })

  onScopeDispose(unsubscribe)

  return viewSchemas
}

export default useViewSchemas
