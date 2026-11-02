/**
 * 将 Core 原生状态转换为快照读取协议。
 *
 * @module core/adapter/formStateAdapter/createFormStateAdapter
 */

import { createComputed, runSignalUntracked } from "../../reactivity"
import { getFormAdapter } from "../formAdapter"

import type {
  FieldSnapshotSource,
  FieldStateSnapshot,
  FormStateAdapter,
  SnapshotSource,
} from "./types"
import type { ReadonlyState } from "../../reactivity"
import type { DeepReadonly, NamePath, SchemxInstance, Values } from "../../types"

/**
 * 快照读取所需的最小原生状态，Signal 和 ReadonlyState 都可直接使用。
 * @typeParam TValue - 原生状态内容。
 */
type SnapshotState<TValue> = Pick<ReadonlyState<TValue>, "value" | "peek">

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
  // 所有状态和原始实例统一从原生适配入口获取。
  const native = getFormAdapter(form)

  // 仅登记此适配器创建的取消函数，不管理共享来源或监听器分发。
  const subscriptions = new Set<() => void>()

  // 复用 Store 字段状态作为键；异构字段来源只在入口恢复路径泛型。
  let fieldSources = new WeakMap<object, unknown>()

  // 原生状态转换按身份缓存，框架读取同一来源时可以共享投影。
  let stateSources = new WeakMap<object, unknown>()

  // 释放后禁止新增订阅或创建字段来源。
  let disposed = false

  /**
   * 登记由当前 adapter 拥有的独立订阅，并统一处理释放期间的重入。
   * @param start - 创建底层订阅的函数。
   */
  const subscribeOwned = (start: () => () => void): (() => void) => {
    if (disposed || native.disposed.peek()) {
      return () => {}
    }

    const cancel = start()

    if (disposed || native.disposed.peek()) {
      cancel()

      return () => {}
    }

    const unsubscribe = (): void => {
      if (subscriptions.delete(unsubscribe)) {
        cancel()
      }
    }

    subscriptions.add(unsubscribe)

    return unsubscribe
  }

  /**
   * 转换快照协议；普通状态使用所属 Form 的 effect，特殊调度沿用原生订阅。
   * @typeParam TSnapshot - 快照内容类型。
   * @param state - 原生状态或唯一的聚合 computed。
   * @param subscribeState - 可选的原生订阅入口，保留视图防抖和同步首值语义。
   */
  const createSource = <TSnapshot>(
    state: SnapshotState<TSnapshot>,
    subscribeState?: (listener: () => void) => () => void
  ): SnapshotSource<TSnapshot> => {
    // 原生状态已经缓存当前值，不再增加 computed 包装。
    const getSnapshot = (): DeepReadonly<TSnapshot> => state.peek()

    /**
     * 独立订阅变化，跳过同步首值；监听器读取不扩展状态依赖。
     * @param listener - 快照变化时执行的消费端回调。
     */
    const subscribe = (listener: () => void): (() => void) =>
      subscribeOwned(() => {
        // 每次订阅单独跳过首次执行。
        let initial = true

        // 统一原生 subscribe 和 effect 的通知协议。
        const notify = (): void => {
          if (initial) {
            initial = false

            return
          }

          runSignalUntracked(listener)
        }

        if (subscribeState) {
          return subscribeState(notify)
        }

        return native.form.effect(() => {
          // 即使绑定其他 Form 的状态，订阅仍归当前 Form 所有。
          void state.value
          notify()
        })
      })

    return { getSnapshot, subscribe }
  }

  // 释放后已有来源仍可读取，但不能再创建或获取来源。
  const assertActive = (): void => {
    if (disposed) {
      throw new Error("[schemx] FormStateAdapter has been disposed.")
    }
  }

  /**
   * 复用原生状态缓存，将订阅生命周期交由当前 Form 和 adapter 管理。
   * @typeParam TValue - 原生状态值类型。
   * @param state - 要转换的原生只读状态。
   */
  const bind = <TValue>(state: ReadonlyState<TValue>): SnapshotSource<TValue> => {
    assertActive()
    const cached = stateSources.get(state)

    if (cached) {
      return cached as SnapshotSource<TValue>
    }

    // 视图沿用原生防抖订阅；普通状态由所属 Form 的 effect 追踪。
    const source = createSource(
      state,
      Object.is(state, native.viewSchemas) ? native.viewSchemas.subscribe : undefined
    )

    stateSources.set(state, source)

    return source
  }

  // 直接转换已有原生状态，不再分别装配 loading、disposed 或视图来源。
  const values = bind(native.values)

  const touchedFields = bind(native.touchedFields)

  const pendingFields = bind(native.pendingFields)

  const loading = bind(native.loading)

  const config = bind(native.config)

  const disposedState = bind(native.disposed)

  const viewSchemas = bind(native.viewSchemas)

  /**
   * 按固定路径读取，不跟随节点移动。
   * @typeParam TName - 固定字段路径。
   * @param name - 要读取的路径。
   * @example const source = adapter.field("name")
   */
  function field<TName extends NamePath<TValues>>(
    name: TName
  ): FieldSnapshotSource<TValues, TName> {
    assertActive()
    // 路径状态及有效性检查统一委托原生适配入口。
    const state = native.field(name)

    const cached = fieldSources.get(state)

    if (cached) {
      return cached as FieldSnapshotSource<TValues, TName>
    }

    // adapter 只转换 Store 原生路径状态的订阅协议。
    const value = bind(state.value)

    const errors = bind(state.errors)

    const touched = bind(state.touched)

    const pending = bind(state.pending)

    const aggregate = createSource<FieldStateSnapshot<TValues, TName>>(
      createComputed(() => ({
        value: state.value.value,
        errors: state.errors.value,
        touched: state.touched.value,
        pending: state.pending.value,
      }))
    )

    const source = {
      ...aggregate,
      value,
      errors,
      touched,
      pending,
    }

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

    subscriptions.clear()
    fieldSources = new WeakMap()
    stateSources = new WeakMap()
  }

  return {
    form: native.form,
    values,
    touchedFields,
    pendingFields,
    loading,
    config,
    disposed: disposedState,
    viewSchemas,
    bind,
    field,
    dispose,
  }
}
