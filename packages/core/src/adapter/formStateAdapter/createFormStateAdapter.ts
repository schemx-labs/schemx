/**
 * 将 Core 原生状态转换为快照读取协议。
 *
 * @module core/adapter/formStateAdapter/createFormStateAdapter
 */

import { createComputed, runSignalUntracked } from "../../reactivity"

import type {
  FieldSnapshotSource,
  FieldStateSnapshot,
  FormStateAdapter,
  SnapshotSource,
} from "./index"
import type { StorePending } from "../../store"
import type { DeepReadonly, NamePath, SchemxInstance, Values } from "../../types"

/**
 * 为 Core Form 提供快照读取与变化订阅，直接复用原生状态的缓存和依赖图。
 *
 * 每次订阅独立取消，Form 销毁时统一停止；dispose 只停止此适配器的订阅。
 * 快照始终读取当前原生状态，适配器释放后仍可读取已取得的来源。
 *
 * @typeParam TValues - Form 的值类型。
 * @param form - 状态与生命周期所属的 Core Form。
 * @returns 只负责协议转换和订阅释放的适配器。
 *
 * @example
 * ```ts
 * const adapter = createFormStateAdapter(form)
 * const stop = adapter.values.subscribe(() => {
 *   console.log(adapter.values.getSnapshot())
 * })
 * stop()
 * adapter.dispose()
 * ```
 */
export function createFormStateAdapter<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormStateAdapter<TValues> {
  // 仅登记此适配器创建的取消函数，不管理共享来源或监听器分发。
  const subscriptions = new Set<() => void>()

  // 复用 Store 字段状态作为键；异构字段来源只在入口恢复路径泛型。
  const fieldSources = new Map<object, unknown>()

  // 释放后禁止新增订阅或创建字段来源。
  let disposed = false

  /**
   * 将原生响应式读取转换为无依赖快照和仅变化通知。
   * @typeParam TSnapshot - 来源提供的快照类型。
   * @param read - 直接读取原生状态或原生 computed。
   */
  const createSource = <TSnapshot>(
    read: () => DeepReadonly<TSnapshot>
  ): SnapshotSource<TSnapshot> => {
    // 快照读取不会把调用方的 effect 绑定到 Core 状态。
    const getSnapshot = (): DeepReadonly<TSnapshot> => runSignalUntracked(read)

    /**
     * 每次调用独立订阅原生依赖，监听器读取不参与依赖追踪。
     * @param listener - 快照变化后的通知回调。
     */
    const subscribe = (listener: () => void): (() => void) => {
      if (disposed) {
        return () => {}
      }

      // 原生 effect 首次执行只建立依赖；快照协议不立即通知。
      let initial = true

      const cancel = form.effect(() => {
        read()

        if (initial) {
          initial = false

          return
        }

        runSignalUntracked(listener)
      })

      // 取消函数只属于当前订阅，同一回调多次订阅也能独立释放。
      const unsubscribe = (): void => {
        if (subscriptions.delete(unsubscribe)) {
          cancel()
        }
      }

      subscriptions.add(unsubscribe)

      return unsubscribe
    }

    return { getSnapshot, subscribe }
  }

  // 表单聚合状态直接复用 Store / Model 的稳定引用。
  const values = createSource<TValues>(() => form.state.values.value)

  const touchedFields = createSource<readonly NamePath<TValues>[]>(
    () => form.state.touchedFields.value
  )

  const pendingFields = createSource<readonly StorePending<TValues, NamePath<TValues>>[]>(
    () => form.state.pendingFields.value
  )

  const loading = createSource<boolean>(() => form.state.loading.value)

  /**
   * 保持按路径读取的契约，使用原生 computed 组装字段聚合快照。
   * @typeParam TName - 固定字段路径，用于推导值类型。
   * @param name - Store 中的字段路径。
   */
  const field = <TName extends NamePath<TValues>>(
    name: TName
  ): FieldSnapshotSource<TValues, TName> => {
    if (disposed) {
      throw new Error("[schemx] FormStateAdapter has been disposed.")
    }

    const state = form.state.field(name)

    const cached = fieldSources.get(state)

    if (cached) {
      return cached as FieldSnapshotSource<TValues, TName>
    }

    // 各属性的比较与缓存由原生状态负责，聚合结果只由 computed 缓存。
    const snapshot = createComputed(() => ({
      value: state.value.value,
      errors: state.errors.value,
      touched: state.touched.value,
      pending: state.pending.value,
    }))

    const source = createSource<FieldStateSnapshot<TValues, TName>>(() => snapshot.value)

    fieldSources.set(state, source)

    return source
  }

  // 只停止本适配器的订阅，其他消费者和原始 Form 继续工作。
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    for (const stop of subscriptions) {
      stop()
    }

    fieldSources.clear()
  }

  return { form, values, touchedFields, pendingFields, loading, field, dispose }
}
