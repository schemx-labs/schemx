/**
 * 将 Core Form 状态组装为框架无关的 FormStateAdapter。
 *
 * @module core/adapter/formStateAdapter/createFormStateAdapter
 */

import { createFieldKey } from "../../utils"

import {
  areFieldStateSnapshotsEqual,
  arePendingFieldsEqual,
  areTouchedFieldsEqual,
  getFieldStateSnapshot,
  getPendingFieldsSnapshot,
  getTouchedFieldsSnapshot,
} from "./snapshots"
import { createManagedSnapshotSource } from "./snapshotSource"

import type { ManagedSnapshotSource } from "./snapshotSource"
import type { FieldSnapshotSource, FieldStateSnapshot, FormStateAdapter } from "./types"
import type { NamePath, SchemxInstance, Values } from "../../types"

/**
 * 创建一个 Form 的状态适配器。
 *
 * 适配器只负责暴露稳定快照和订阅，不创建第二份可写状态，也不销毁传入的 Form。
 * 全表和聚合来源按订阅惰性启动；字段来源按规范化路径缓存并共享。
 *
 * @typeParam TValues - Form 的值类型。
 * @param form - 要暴露状态快照的 Core Form。
 * @returns 与传入 Form 关联的状态适配器。
 *
 * @example
 * ```ts
 * const adapter = createFormStateAdapter(form)
 * const unsubscribe = adapter.loading.subscribe(() => {
 *   console.log(adapter.loading.getSnapshot())
 * })
 *
 * unsubscribe()
 * adapter.dispose()
 * ```
 */
export function createFormStateAdapter<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormStateAdapter<TValues> {
  // getFieldsValue() 用于在 effect 中建立全表值依赖，快照本身仍读取稳定的字段快照。
  const values = createManagedSnapshotSource({
    form,
    track: () => {
      form.getFieldsValue()
    },
    readSnapshot: () => form.getFieldsSnapshot(),
    isSnapshotEqual: Object.is,
  })

  const touchedFields = createManagedSnapshotSource({
    form,
    readSnapshot: () => getTouchedFieldsSnapshot(form),
    isSnapshotEqual: areTouchedFieldsEqual,
  })

  const pendingFields = createManagedSnapshotSource({
    form,
    readSnapshot: () => getPendingFieldsSnapshot(form),
    isSnapshotEqual: arePendingFieldsEqual,
  })

  const loading = createManagedSnapshotSource({
    form,
    readSnapshot: () => form.isLoading(),
    isSnapshotEqual: Object.is,
  })

  // 不同字段路径具有不同的快照类型，因此缓存内部使用 unknown，再在入口处恢复泛型。
  const fieldSources = new Map<string, ManagedSnapshotSource<unknown>>()

  // 适配器释放后，所有公开来源都不再拥有可用的 Core effect。
  let disposed = false

  /**
   * 取得并缓存规范化字段路径对应的快照来源。
   *
   * @param name - 要读取的字段路径。
   * @returns 对应字段的稳定快照来源。
   * @throws 适配器已经释放时抛出错误。
   */
  const field = <TName extends NamePath<TValues>>(
    name: TName
  ): FieldSnapshotSource<TValues, TName> => {
    if (disposed) {
      throw new Error("[schemx] FormStateAdapter has been disposed.")
    }

    const key = createFieldKey(name)

    const cachedSource = fieldSources.get(key)

    if (cachedSource) {
      return cachedSource as FieldSnapshotSource<TValues, TName>
    }

    const source = createManagedSnapshotSource<
      TValues,
      FieldStateSnapshot<TValues, TName>
    >({
      form,
      readSnapshot: () => getFieldStateSnapshot(form, name),
      isSnapshotEqual: areFieldStateSnapshotsEqual,
    })

    fieldSources.set(key, source)

    return source
  }

  /**
   * 释放适配器创建的全部快照来源。
   *
   * 原始 Form 的生命周期由调用方负责；此处只释放适配器拥有的 effect、监听器和缓存。
   */
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    values.dispose()
    touchedFields.dispose()
    pendingFields.dispose()
    loading.dispose()

    for (const source of fieldSources.values()) {
      source.dispose()
    }

    fieldSources.clear()
  }

  return {
    form,
    values,
    touchedFields,
    pendingFields,
    loading,
    field,
    dispose,
  }
}
