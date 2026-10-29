/**
 * 将 Core 原生状态转换为快照读取协议。
 *
 * @module core/adapter/formStateAdapter/createFormStateAdapter
 */

import { createComputed, runSignalUntracked } from "../../reactivity"

import { getFormStateAdapterContext } from "./context"

import type {
  FieldRefSnapshotSource,
  FieldSnapshotSource,
  FieldStateSnapshot,
  FormStateAdapter,
  SnapshotSource,
} from "./types"
import type { ReadonlyState } from "../../reactivity"
import type { FieldRef } from "../../types"
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
  // 直接使用所属表单操作，公开实例不再提供聚合 state。
  const {
    store,
    configuration,
    disposed: formDisposed,
    loading: formLoading,
  } = getFormStateAdapterContext(form)

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
    if (disposed || formDisposed.peek()) {
      return () => {}
    }

    const cancel = start()

    if (disposed) {
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
   * 由原生 computed 缓存聚合结果，快照读取和监听器均不污染 Core 依赖。
   * @typeParam TSnapshot - 聚合结果类型。
   * @param read - 读取原生响应式状态。
   */
  const createSource = <TSnapshot>(
    read: () => DeepReadonly<TSnapshot>
  ): SnapshotSource<TSnapshot> => {
    const snapshot = createComputed(read)

    const getSnapshot = (): DeepReadonly<TSnapshot> => snapshot.peek()

    const subscribe = (listener: () => void): (() => void) =>
      subscribeOwned(() => {
        let initial = true

        return form.effect(() => {
          void snapshot.value
          if (initial) {
            initial = false

            return
          }

          runSignalUntracked(listener)
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
   * 转换原生状态，复用其缓存和订阅生命周期，不创建另一套 effect。
   * @typeParam TValue - 原生状态值类型。
   * @param state - 要转换的原生只读状态。
   */
  const bind = <TValue>(state: ReadonlyState<TValue>): SnapshotSource<TValue> => {
    assertActive()
    const cached = stateSources.get(state)

    if (cached) {
      return cached as SnapshotSource<TValue>
    }

    const getSnapshot = (): DeepReadonly<TValue> => state.peek()

    const subscribe = (listener: () => void): (() => void) =>
      subscribeOwned(() => {
        let initial = true

        return state.subscribe(() => {
          if (initial) {
            initial = false

            return
          }

          runSignalUntracked(listener)
        })
      })

    const source = { getSnapshot, subscribe }

    stateSources.set(state, source)

    return source
  }

  // 聚合状态来源直接复用原生只读状态。
  const values = bind(store.state.values)

  const touchedFields = bind(store.state.touchedFields)

  const pendingFields = bind(store.state.pendingFields)

  const loading = createSource(() => formLoading.value)

  const config = bind(configuration.state)

  const disposedState = createSource(() => formDisposed.value)

  // ViewSchema 使用原来的订阅入口，保留其防抖与首值语义。
  // 深层只读是消费契约；不复制或代理 Schema 内的组件与回调定义。
  const getViewSnapshot = (): ReturnType<
    FormStateAdapter<TValues>["viewSchemas"]["getSnapshot"]
  > =>
    runSignalUntracked(() => form.getViewSchemas()) as ReturnType<
      FormStateAdapter<TValues>["viewSchemas"]["getSnapshot"]
    >

  const subscribeView = (listener: () => void): (() => void) =>
    subscribeOwned(() => {
      let initial = true

      return form.subscribeViewSchemas(() => {
        if (initial) {
          initial = false

          return
        }

        runSignalUntracked(listener)
      })
    })

  const viewSchemas = { getSnapshot: getViewSnapshot, subscribe: subscribeView }

  /**
   * 按引用身份读取，移动后继续跟随该节点。
   * @typeParam TName - 引用初始字段路径。
   * @param ref - 当前表单的稳定字段引用。
   */
  function field<TName extends NamePath<TValues>>(
    ref: FieldRef<TValues, TName>
  ): FieldRefSnapshotSource<TValues, TName>
  /**
   * 按固定路径读取，不跟随节点移动。
   * @typeParam TName - 固定字段路径。
   * @param name - 要读取的路径。
   */
  function field<TName extends NamePath<TValues>>(
    name: TName
  ): FieldSnapshotSource<TValues, TName>
  // 引用的失效语义由 Form 处理，Store 路径来源仍保留原生读取语义。
  function field<TName extends NamePath<TValues>>(
    input: TName | FieldRef<TValues, TName>
  ): FieldSnapshotSource<TValues, TName> {
    assertActive()
    const ref =
      typeof input === "object" ? (input as FieldRef<TValues, TName>) : undefined

    const state = ref ? form.getFieldState(ref) : store.state.field(input as TName)

    const cached = fieldSources.get(state)

    if (cached) {
      return cached as FieldSnapshotSource<TValues, TName>
    }

    // Form 已统一引用状态的终态语义，adapter 只转换订阅协议。
    const value = bind(state.value)

    const errors = bind(state.errors)

    const touched = bind(state.touched)

    const pending = bind(state.pending)

    const aggregate = createSource<FieldStateSnapshot<TValues, TName>>(() => ({
      value: state.value.value,
      errors: state.errors.value,
      touched: state.touched.value,
      pending: state.pending.value,
    }))

    const source = {
      ...aggregate,
      value,
      errors,
      touched,
      pending,
      ...(ref
        ? {
            name: bind(form.getFieldState(ref).name),
            disposed: bind(form.getFieldState(ref).disposed),
          }
        : {}),
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
    form,
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
