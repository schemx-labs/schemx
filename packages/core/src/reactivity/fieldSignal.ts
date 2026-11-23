/**
 * FieldSignal - 表单字段状态专用 signal。
 *
 * 该模块是在通用 `createSignal` 之上的领域化组合原语。它不改变
 * `createSignal` 的基础语义，而是为表单字段提供一个更高层的响应式单元：
 * 当前值、初始值、触碰状态和异步 pending 状态共享同一个生命周期与操作入口。
 *
 * 适用边界：
 * - Store 可用它作为字段状态的最小存储单元。
 * - View 可通过 Store 或 FormApi 间接消费这些状态。
 * - FieldModel 不应使用它；FieldModel 只保存字段呈现态。
 *
 * @module core/reactivity/fieldSignal
 */

import { cloneDeep } from "es-toolkit"

import { createSignal } from "./signal"

import type { Signal } from "./signal"

/**
 * createFieldSignal 配置项。
 */
export type FieldSignalOptions<TValue> = {
  /**
   * 字段当前值。
   *
   * 读取 `.value` 会建立响应式依赖；写入应优先使用 `setValue`，
   * 以便调用方在同一处维护 touched/dirty 等派生策略。
   */
  value?: TValue | undefined

  /**
   * 字段初始值。
   *
   * 用于 reset 和 dirty/touched 策略判断。该值与当前值分离，允许
   * setInitialValues 只更新 baseline，而不强行覆盖用户当前输入。
   */
  initialValue?: TValue | undefined

  /**
   * 字段触碰/修改状态。
   *
   * 这是显式 signal，Store 可以选择在 setFieldValue 时自动更新，
   * 也可以通过 setTouched 手动设置。
   */
  touched?: boolean

  /**
   * 字段 pending 状态。
   */
  pending?: boolean
}

/**
 * 字段状态的无追踪快照。
 *
 * 通过 `FieldSignal.peek()` 返回，用于 Store 内部同步判断或调试读取。
 * 它不会建立响应式依赖，也不暴露底层 signal。
 */
export interface FieldSignalSnapshot<TValue> {
  /**
   * 字段当前值
   */
  readonly value: TValue | undefined

  /**
   * 字段初始值 baseline
   */
  readonly initialValue: TValue | undefined

  /**
   * 字段是否被触碰/修改
   */
  readonly touched: boolean

  /**
   * 字段是否 pending
   */
  readonly pending: boolean

  /**
   * 字段 pending 信息。
   */
  readonly pendingMessage: string[]
}

/**
 * 表单字段状态 signal 的状态接口。
 *
 * @typeParam TValue - 字段值类型
 */
export interface FieldSignalState<TValue> {
  /**
   * 字段当前值。
   *
   * 读取 `.value` 会建立响应式依赖；写入应优先使用 `setValue`，
   * 以便调用方在同一处维护 touched/dirty 等派生策略。
   */
  readonly value: Signal<TValue | undefined>

  /**
   * 字段初始值。
   *
   * 用于 reset 和 dirty/touched 策略判断。该值与当前值分离，允许
   * setInitialValues 只更新 baseline，而不强行覆盖用户当前输入。
   */
  readonly initialValue: Signal<TValue | undefined>

  /**
   * 字段触碰/修改状态。
   *
   * 这是显式 signal，Store 可以选择在 setFieldValue 时自动更新，
   * 也可以通过 setTouched 手动设置。
   */
  readonly touched: Signal<boolean>

  /**
   * 字段 pending 状态。
   */
  readonly pending: Signal<boolean>

  /**
   * 字段 pending 信息。
   */
  readonly pendingMessage: Signal<string[]>
}

/**
 * 表单字段状态 signal 的操作接口。
 *
 * @typeParam TValue - 字段值类型
 */
export interface FieldSignalAction<TValue> {
  /**
   * 设置字段当前值。
   *
   * @param value - 新字段值。
   */
  setValue(value: TValue | undefined): void

  /**
   * 设置字段初始值 baseline。
   *
   * @param value - 新初始值。
   */
  setInitialValue(value: TValue | undefined): void

  /**
   * 设置字段 touched 状态。
   *
   * @param touched - 是否已触碰或修改。
   */
  setTouched(touched: boolean): void

  /**
   * 设置字段 pending 状态。
   *
   * @param pending - 是否正在处理异步操作。
   * @param message - 可选的操作中提示信息。
   */
  setPending(pending: boolean, message?: string | string[]): void

  /**
   * 将字段重置到指定值；未传入时重置到当前 initialValue。
   *
   * reset 同时清空 touched 和 pending。
   *
   * @param value - 可选重置目标值。
   */
  reset(value?: TValue): void

  /**
   * 无依赖追踪地获取字段 signal。
   *
   * @returns 当前字段状态快照。
   */
  peek(): FieldSignalSnapshot<TValue>
}

/**
 * 表单字段状态专用 signal。
 *
 * @typeParam TValue - 字段值类型
 */
export type FieldSignal<TValue> = FieldSignalState<TValue> & FieldSignalAction<TValue>

/**
 * 创建表单字段状态专用 signal。
 *
 * @typeParam TValue - 字段值类型
 * @param options - 字段状态配置项。
 * @returns 字段状态 signal
 */
export function createFieldSignal<TValue>(
  options?: FieldSignalOptions<TValue>
): FieldSignal<TValue> {
  const { value, initialValue, touched, pending } = options || {}

  const valueSignal = createSignal<TValue | undefined>(
    value === undefined ? undefined : cloneDeep(value)
  )
  const initialSignal = createSignal<TValue | undefined>(
    initialValue === undefined ? undefined : cloneDeep(initialValue)
  )
  const touchedSignal = createSignal(touched ?? false)
  const pendingSignal = createSignal(pending ?? false)
  const pendingMessageSignal = createSignal<string[]>([])

  /**
   * 写入字段当前值 signal。
   */
  const setValue = (next: TValue | undefined): void => {
    valueSignal.value = next
  }

  /**
   * 写入字段初始值 baseline signal。
   */
  const setInitialValue = (next: TValue | undefined): void => {
    initialSignal.value = next
  }

  /**
   * 写入字段 touched signal。
   */
  const setTouched = (next: boolean): void => {
    touchedSignal.value = next
  }

  /**
   * 写入字段 pending signal。
   */
  const setPending = (next: boolean, message?: string | string[]): void => {
    pendingSignal.value = next

    if (next) {
      if (message) {
        pendingMessageSignal.value = Array.isArray(message) ? message : [message]
      }
    } else {
      pendingMessageSignal.value = []
    }
  }

  /**
   * 将字段状态重置到指定值或当前 baseline。
   */
  const reset = (next = initialSignal.peek()): void => {
    valueSignal.value = cloneDeep(next)
    touchedSignal.value = false
    pendingSignal.value = false
  }

  /**
   * 读取字段状态的无追踪快照。
   */
  const peek = (): FieldSignalSnapshot<TValue> => {
    return {
      value: valueSignal.peek(),
      initialValue: initialSignal.peek(),
      touched: touchedSignal.peek(),
      pending: pendingSignal.peek(),
      pendingMessage: pendingMessageSignal.peek(),
    }
  }

  return {
    value: valueSignal,
    initialValue: initialSignal,
    touched: touchedSignal,
    pending: pendingSignal,
    pendingMessage: pendingMessageSignal,
    setValue,
    setInitialValue,
    setTouched,
    setPending,
    reset,
    peek,
  }
}
