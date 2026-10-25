/**
 * 将 Core 原生只读状态投影为共享 Vue 浅引用。
 *
 * Core 负责派生状态和变化通知；这里仅管理 Vue 外壳、身份缓存与订阅释放。
 * @module vue/bridge/stateBridge
 */

import { shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type {
  DeepReadonly,
  FieldState,
  FieldValue,
  NamePath,
  ReadonlyState,
  SchemxFieldState,
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
 * 控制器投影额外保留当前路径；路径失效时由 Core 返回 undefined。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 控制器的初始路径。
 */
export interface VueBoundFieldState<
  TValues extends Values,
  TName extends NamePath<TValues>,
> extends VueFieldState<TValues, TName> {
  /**
   * 当前实际路径。
   */
  readonly name: VueStateRef<NamePath<TValues> | undefined>
}

/**
 * 一个 Runtime 资源周期内共享的原生状态绑定。
 */
export interface VueStateBridge {
  /**
   * 同一原生状态只订阅一次，释放后保留最后一次投影值。
   * @typeParam TValue - 原生状态值类型。
   * @param state - Core 提供的原生只读状态。
   * @throws bridge 已释放时不能再调用 bind，包括读取原有缓存。
   * @example const loading = bridge.bind(form.state.loading)
   */
  bind<TValue>(state: ReadonlyState<TValue>): VueStateRef<TValue>
  /**
   * 按控制器状态身份投影字段，保留其当前路径。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 控制器初始路径。
   * @param state - Core 字段控制器状态。
   * @example const field = bridge.field(controller.state)
   */
  field<TValues extends Values, TName extends NamePath<TValues>>(
    state: SchemxFieldState<TValues, TName>
  ): VueBoundFieldState<TValues, TName>
  /**
   * 按固定路径的 Store 状态投影字段。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 固定字段路径。
   * @param state - Core Store 的路径状态。
   * @example const field = bridge.field(form.state.field("name"))
   */
  field<TValues extends Values, TName extends NamePath<TValues>>(
    state: FieldState<TValues, TName>
  ): VueFieldState<TValues, TName>
  /**
   * 释放所有绑定的原生订阅，重复调用无副作用。
   * 已交付的 Ref 不清空，后续 Core 更新不再改变其值。
   * @example bridge.dispose()
   */
  dispose(): void
}

/**
 * 将 Core 原生状态绑定为 Vue Ref，共享缓存和订阅回收。
 * @example
 * const bridge = createVueStateBridge()
 * const loading = bridge.bind(form.state.loading)
 * bridge.dispose()
 */
export function createVueStateBridge(): VueStateBridge {
  // 状态对象与字段状态容器都是稳定身份，共用一份异构缓存。
  const cache = new WeakMap<object, unknown>()

  // 这里只保存订阅取消函数，不维护第二套状态或监听器分发。
  const subscriptions = new Set<() => void>()

  // 关闭后禁止创建新的桥接状态。
  let disposed = false

  /**
   * 原生状态负责变化检测；Vue shallowRef 只传递引用。
   * @typeParam TValue - 原生状态值类型。
   * @param state - 要绑定的原生只读状态。
   */
  const bind = <TValue>(state: ReadonlyState<TValue>): VueStateRef<TValue> => {
    if (disposed) {
      throw new Error("[schemx] Vue state bridge has been disposed.")
    }

    // 缓存键已确定值类型，只在此异构读取边界恢复泛型。
    const cached = cache.get(state)

    if (cached) {
      return cached as VueStateRef<TValue>
    }

    // shallowRef 不解包嵌套值；断言仅保留泛型的 Vue Ref 外壳。
    const ref = shallowRef(state.peek()) as ShallowRef<DeepReadonly<TValue>>

    cache.set(state, ref)
    subscriptions.add(
      state.subscribe(
        /**
         * 将 Core 的同步首值和后续快照发布到同一个 Vue 引用。
         * @param value - Core 当前的只读状态值。
         */
        (value) => {
          ref.value = value
        }
      )
    )

    return ref
  }

  // 控制器重载遵循 VueStateBridge.field 的契约，额外投影其当前路径。
  function field<TValues extends Values, TName extends NamePath<TValues>>(
    state: SchemxFieldState<TValues, TName>
  ): VueBoundFieldState<TValues, TName>
  // Store 重载遵循 VueStateBridge.field 的契约，保持固定路径的状态来源。
  function field<TValues extends Values, TName extends NamePath<TValues>>(
    state: FieldState<TValues, TName>
  ): VueFieldState<TValues, TName>
  // 以状态容器身份缓存字段投影；各成员的订阅统一交给 bind 回收。
  function field<TValues extends Values, TName extends NamePath<TValues>>(
    state: FieldState<TValues, TName> | SchemxFieldState<TValues, TName>
  ): VueFieldState<TValues, TName> {
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
      ...("name" in state ? { name: bind(state.name) } : {}),
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
    // 每个取消函数对应唯一的原生订阅，缓存仍可由 WeakMap 自动回收。
    for (const stop of subscriptions) {
      stop()
    }

    subscriptions.clear()
  }

  return { bind, field, dispose }
}
