/**
 * 将 Core adapter 快照来源投影为共享 Vue 浅引用。
 *
 * Core 负责派生状态和变化通知；这里仅管理 Vue 外壳、身份缓存与订阅释放。
 * @module vue/bridge/stateBridge
 */

import { shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type {
  DeepReadonly,
  FieldSnapshotSource,
  FieldValue,
  FormStateAdapter,
  NamePath,
  SnapshotSource,
  Values,
} from "@schemx/core"

/**
 * Core 深层只读值的 Vue Ref 外壳，不改变值本身的类型契约。
 * @typeParam TValue - 原生状态值类型。
 */
export type VueStateRef<TValue> = Readonly<ShallowRef<DeepReadonly<TValue>>>

/**
 * 字段原生状态的 Vue 投影，读取值沿用 Core 的深层只读契约。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段的初始路径。
 */
export interface VueFieldState<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 当前字段值。
   */
  readonly value: VueStateRef<FieldValue<TValues, TName> | undefined>
  /**
   * 当前错误消息。
   */
  readonly errors: VueStateRef<readonly string[]>
  /**
   * 当前触摸状态。
   */
  readonly touched: VueStateRef<boolean>
  /**
   * 当前业务操作状态。
   */
  readonly pending: VueStateRef<boolean>
}

/**
 * 一个 Runtime 资源周期内共享的 adapter 来源投影。
 */
export interface VueStateBridge {
  /**
   * 同一快照来源只订阅一次，释放后保留最后一次投影值。
   * @typeParam TValue - 原生状态值类型。
   * @param state - Core adapter 提供的快照来源。
   * @throws bridge 已释放时不能再调用 bind，包括读取原有缓存。
   * @example const loading = bridge.bind(adapter.loading)
   */
  bind<TValue>(state: SnapshotSource<TValue>): VueStateRef<TValue>
  /**
   * 按固定路径的 adapter 来源投影字段。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 固定字段路径。
   * @param state - Core Store 的路径状态。
   * @example const field = bridge.field(adapter.field("name"))
   */
  field<TValues extends Values, TName extends NamePath<TValues>>(
    state: FieldSnapshotSource<TValues, TName>
  ): VueFieldState<TValues, TName>
  /**
   * 释放所有绑定的原生订阅，重复调用无副作用。
   * 已交付的 Ref 不清空，后续 Core 更新不再改变其值。
   * @example bridge.dispose()
   */
  dispose(): void
}

/**
 * 将 adapter 快照来源绑定为 Vue Ref，共享缓存并拥有 adapter 的释放周期。
 * @typeParam TValues - adapter 对应的表单值类型。
 * @param adapter - 当前资源周期专用的 Core adapter。
 * @example
 * const bridge = createVueStateBridge(adapter)
 * const loading = bridge.bind(adapter.loading)
 * bridge.dispose()
 */
export function createVueStateBridge<TValues extends Values>(
  adapter: FormStateAdapter<TValues>
): VueStateBridge {
  // 状态对象与字段状态容器都是稳定身份，共用一份异构缓存。
  const cache = new WeakMap<object, unknown>()

  // 关闭后禁止创建新的桥接状态。
  let disposed = false

  /**
   * adapter 负责变化检测；Vue shallowRef 只传递引用。
   * @typeParam TValue - 原生状态值类型。
   * @param state - 要绑定的 adapter 快照来源。
   */
  const bind = <TValue>(state: SnapshotSource<TValue>): VueStateRef<TValue> => {
    if (disposed) {
      throw new Error("[schemx] Vue state bridge has been disposed.")
    }

    // 缓存键已确定值类型，只在此异构读取边界恢复泛型。
    const cached = cache.get(state)

    if (cached) {
      return cached as VueStateRef<TValue>
    }

    // shallowRef 不解包嵌套值；断言仅保留泛型的 Vue Ref 外壳。
    const ref = shallowRef(state.getSnapshot()) as ShallowRef<DeepReadonly<TValue>>

    cache.set(state, ref)
    state.subscribe(() => {
      ref.value = state.getSnapshot()
    })

    return ref
  }

  /**
   * 以固定路径来源身份缓存字段投影，成员订阅统一交给 bind 回收。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 固定字段路径。
   * @param state - Form adapter 的路径状态来源。
   */
  const field = <TValues extends Values, TName extends NamePath<TValues>>(
    state: FieldSnapshotSource<TValues, TName>
  ): VueFieldState<TValues, TName> => {
    // 同一状态容器复用投影对象，避免 Hook 各自拼装独立 Ref。
    const cached = cache.get(state)

    if (cached) {
      return cached as VueFieldState<TValues, TName>
    }

    // 控制器包含 name 状态；普通 Store 路径状态无需维护另一份路径。
    const projected = {
      value: bind(state.value),
      errors: bind(state.errors),
      touched: bind(state.touched),
      pending: bind(state.pending),
    }

    cache.set(state, projected)

    return projected
  }

  // 最后一个 Vue owner 释放资源时统一取消原生订阅。
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    adapter.dispose()
  }

  return { bind, field, dispose }
}
