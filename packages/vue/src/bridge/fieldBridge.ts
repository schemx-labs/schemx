/**
 * 将 Core 字段快照投影为可共享的 Vue Ref。
 *
 * @module vue/bridge/fieldBridge
 */

import { areStringListsEqual, createVueShallowRef } from "./helpers"

import type { ManagedVueFieldBridge, VueFieldBridge, VueFormBridge } from "./types"
import type { FieldValue, NamePath, Values } from "@schemx/core"

/**
 * 获取一个字段的共享 Vue Ref 投影。
 *
 * 字段 Bridge 以 Core `FieldSnapshotSource` 的对象身份缓存，因此同一 Form
 * 中对同一规范化字段路径的多次读取会复用同一组 Ref。
 *
 * @typeParam TValues - Form 的值类型。
 * @typeParam TName - 字段路径类型。
 * @param bridge - 所属 Form Bridge。
 * @param name - 字段路径。
 * @returns 对应字段的共享 Vue Bridge。
 *
 * @example
 * ```ts
 * const bridge = getVueFormBridge(form)
 * const field = getVueFieldBridge(bridge, "email")
 * watchEffect(() => console.log(field.value.value))
 * ```
 */
export function getVueFieldBridge<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(bridge: VueFormBridge<TValues>, name: TName): VueFieldBridge<TValues, TName> {
  // FormStateAdapter 按规范化路径缓存 Source；Source 身份可作为稳定的 Bridge key。
  const source = bridge.stateAdapter.field(name)

  // 同一 Source 复用同一组 Ref，避免多个消费者产生重复订阅。
  const cachedBridge = bridge.fieldBridges.get(source as object)

  if (cachedBridge) {
    return cachedBridge as VueFieldBridge<TValues, TName>
  }

  // 首次读取快照用于初始化所有字段 Ref。
  const snapshot = source.getSnapshot()

  const value = createVueShallowRef<FieldValue<TValues, TName> | undefined>(
    snapshot.value
  )

  const errors = createVueShallowRef<readonly string[]>(snapshot.errors)

  const touched = createVueShallowRef<boolean>(snapshot.touched)

  const pending = createVueShallowRef<boolean>(snapshot.pending)

  // 逐项比较后再写入，避免无关字段状态变化触发 Vue 更新。
  const updateFieldRefs = (): void => {
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

  const unsubscribe = source.subscribe(updateFieldRefs)

  /**
   * 停止字段快照到 Vue Ref 的同步订阅。
   */
  const dispose = (): void => {
    unsubscribe()
  }

  // 缓存完整的可管理对象，但对外只暴露字段 Ref 投影。
  const fieldBridge: ManagedVueFieldBridge<TValues> = {
    source,
    value,
    errors,
    touched,
    pending,
    dispose,
  }

  bridge.fieldBridges.set(source as object, fieldBridge)

  return fieldBridge as VueFieldBridge<TValues, TName>
}
