/**
 * 将 Core 字段快照投影为可共享的 Vue Ref。
 *
 * 字段投影只负责创建状态；来源订阅由所属 FormStateAdapter 统一回收。
 *
 * @module vue/bridge/fieldBridge
 */

import { areStringListsEqual, createVueShallowRef } from "./helpers"

import type { VueFieldState, VueFormResources } from "./types"
import type { FieldValue, NamePath, Values } from "@schemx/core"

/**
 * 获取一个字段的共享 Vue 状态投影。
 *
 * FormStateAdapter 按规范化路径缓存 Source；Source 身份作为当前资源中的
 * 稳定 key，确保同一字段不会重复创建订阅。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param resources - 当前 Runtime 的响应式资源集合。
 * @param name - 要读取状态的字段路径。
 * @returns 当前字段的共享 Vue 状态投影。
 *
 * @example
 * ```ts
 * const state = getVueFieldState(resources, "name")
 * console.log(state.value.value)
 * ```
 */
export function getVueFieldState<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(resources: VueFormResources<TValues>, name: TName): VueFieldState<TValues, TName> {
  const source = resources.stateAdapter.field(name)

  const cachedState = resources.fieldStates.get(source as object)

  if (cachedState) {
    return cachedState as VueFieldState<TValues, TName>
  }

  const snapshot = source.getSnapshot()

  const value = createVueShallowRef<FieldValue<TValues, TName> | undefined>(
    snapshot.value
  )

  const errors = createVueShallowRef<readonly string[]>(snapshot.errors)

  const touched = createVueShallowRef<boolean>(snapshot.touched)

  const pending = createVueShallowRef<boolean>(snapshot.pending)

  const updateFieldState = (): void => {
    const nextSnapshot = source.getSnapshot()

    if (!Object.is(value.value, nextSnapshot.value)) {
      value.value = nextSnapshot.value
    }

    if (!areStringListsEqual(errors.value, nextSnapshot.errors)) {
      errors.value = nextSnapshot.errors
    }

    if (touched.value !== nextSnapshot.touched) {
      touched.value = nextSnapshot.touched
    }

    if (pending.value !== nextSnapshot.pending) {
      pending.value = nextSnapshot.pending
    }
  }

  source.subscribe(updateFieldState)

  const fieldState: VueFieldState<TValues, TName> = {
    value,
    errors,
    touched,
    pending,
  }

  resources.fieldStates.set(source as object, fieldState as VueFieldState<TValues>)

  return fieldState
}
