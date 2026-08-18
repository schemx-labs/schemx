/**
 * 将 Core FieldArray 结构投影为共享的 Vue Ref。
 *
 * @module vue/bridge/fieldArrayBridge
 */

import { readonly } from "vue"

import { createVueShallowRef } from "./helpers"

import type { ManagedVueFieldArrayState, VueFormResources } from "./types"
import type { FieldArrayField, FieldArrayPath, Values } from "@schemx/core"

/**
 * 获取同一 Form、同一路径共享的 FieldArray 状态。
 *
 * FieldArray effect 的释放由所属 Runtime 统一管理。
 */
export function getVueFieldArrayState<
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
>(
  resources: VueFormResources<TValues>,
  name: TPath
): Pick<ManagedVueFieldArrayState<TValues, TPath>, "controller" | "fields"> {
  const controller = resources.stateAdapter.form.getOrCreateFieldArray(name)

  const cachedState = resources.fieldArrayStates.get(controller as object)

  if (cachedState) {
    return cachedState as Pick<
      ManagedVueFieldArrayState<TValues, TPath>,
      "controller" | "fields"
    >
  }

  const fields = createVueShallowRef<readonly FieldArrayField[]>([])

  const dispose = resources.stateAdapter.form.effect(() => {
    fields.value = controller.getFields()
  })

  const fieldArrayState: ManagedVueFieldArrayState<TValues, TPath> = {
    controller,
    fields: readonly(fields),
    dispose,
  }

  resources.fieldArrayStates.set(
    controller as object,
    fieldArrayState as ManagedVueFieldArrayState<TValues, FieldArrayPath<TValues>>
  )

  return fieldArrayState
}
