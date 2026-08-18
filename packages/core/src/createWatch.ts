/**
 * createWatch - 基于 reactive effect 的字段监听工具
 *
 * 提供不依赖任何 UI 框架的字段监听能力，基于 form.effect() 自动依赖追踪。
 * 适用于非组件场景（如工具函数、外部逻辑）。
 *
 * 提供四种使用方式：
 * - {@link createWatch} — 统一入口，根据参数类型自动分发
 * - {@link createWatchField} — 监听单个字段
 * - {@link createWatchFields} — 监听多个字段
 * - {@link createWatchAll} — 监听所有字段
 *
 * 所有回调采用 payload 模式：`(latestSnapshot, payload)`，
 * payload 包含变更的详细信息，latestSnapshot 为变更后的表单完整快照。
 *
 * @module core/createWatch
 *
 * @example
 * ```ts
 * import { createWatch, createWatchField, createWatchFields, createWatchAll } from '@schemx/core'
 *
 * // 统一入口 — 根据参数类型自动分发
 * createWatch(form, 'username', (_snapshot, payload) => {
 *   // payload: { value, prevValue }
 * })
 * createWatch(form, ['firstName', 'lastName'], (_snapshot, payload) => {
 *   // payload: { changedPaths, changedValues, prevValues }
 * })
 * createWatch(form, (_snapshot, payload) => {
 *   // payload: { changedPaths, changedValues, prevValues }
 * })
 *
 * // 监听单个字段
 * const dispose = createWatchField(form, 'username', (snapshot, payload) => {
 *   console.log(`${payload.prevValue} -> ${payload.value}`)
 * }, { immediate: true })
 *
 * // 监听多个字段
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (snapshot, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * }, {})
 *
 * // 监听所有字段
 * const dispose = createWatchAll(form, (snapshot, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * }, {})
 *
 * // 取消监听
 * dispose()
 * ```
 */

import { isEqual } from "es-toolkit/compat"

import { runSignalUntracked } from "./reactivity"
import { collectObjectPathsByLeaf, diff } from "./utils"

import type { FieldValue, NamePath, SchemxInstance, Values } from "./types"

/**
 * 单字段订阅回调的载荷。
 */
type FieldPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /**
   * 变更后的字段值。
   */
  value: FieldValue<TValues, TName> | undefined
  /**
   * 变更前的字段值。
   */
  prevValue: FieldValue<TValues, TName> | undefined
}

/**
 * 多字段订阅回调的载荷。
 */
type FieldsPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /**
   * 本次变更涉及的所有字段路径。
   */
  changedPaths: TName[]
  /**
   * 本次变更涉及的字段值（部分表单数据）。
   */
  changedValues: Partial<TValues>
  /**
   * 变更前对应字段的旧值（部分表单数据）。
   */
  prevValues: Partial<TValues>
}

/**
 * 全局订阅回调的载荷。
 */
type GlobalPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /**
   * 本次变更涉及的所有字段路径。
   */
  changedPaths: TName[]
  /**
   * 本次变更涉及的字段值（部分表单数据）。
   */
  changedValues: Partial<TValues>
  /**
   * 变更前对应字段的旧值（部分表单数据）。
   */
  prevValues: Partial<TValues>
}

/**
 * 订阅回调的基础类型。
 *
 * 回调接收两个参数：变更后的表单完整快照（latestSnapshot）和变更载荷（payload）。
 */
type BaseSubscribeCallback<TValues, TPayload> = (
  latestSnapshot: TValues,
  payload: TPayload
) => void

/**
 * 单字段订阅回调类型。
 *
 * 第一个参数是最新表单快照；payload 为 `{ value, prevValue }`，分别表示
 * 目标字段的新值和旧值。
 */
export type WatchFieldCallback<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = BaseSubscribeCallback<TValues, FieldPayload<TValues, TName>>

/**
 * 多字段订阅回调类型。
 *
 * payload 为 `{ changedPaths, changedValues, prevValues }`：分别表示发生变化的
 * 路径、被监听字段集合内的新值，以及对应的旧值。
 */
export type WatchFieldsCallback<TValues extends Values> = BaseSubscribeCallback<
  TValues,
  FieldsPayload<TValues>
>

/**
 * 全局订阅回调类型。
 *
 * payload 为 `{ changedPaths, changedValues, prevValues }`：分别表示发生变化的
 * 路径、变更后的部分表单值，以及变更前的部分表单值。
 */
export type WatchAllCallback<TValues extends Values> = BaseSubscribeCallback<
  TValues,
  GlobalPayload<TValues>
>

/**
 * useWatch / createWatch 选项
 */
export interface CreateWatchOptions {
  /**
   * 是否在创建后立即执行一次回调
   *
   * @default false
   */
  immediate?: boolean

  /**
   * 是否在新旧值深度相等时跳过回调
   *
   * 开启后，使用 `isEqual`（来自 es-toolkit）对新旧值进行深度比较，
   * 若相等则不触发回调，可减少不必要的执行。
   *
   * @default false
   */
  inequality?: boolean
}

/**
 * createWatch 系列函数的返回类型 - 取消监听函数
 *
 * 调用后将移除对应的 effect，不再接收后续变更通知。
 */
export type CreateWatchReturn = () => void

/**
 * 监听单个字段变化（基于 reactive effect）
 *
 * 在 effect 内调用 form.getFieldValue(name) 建立依赖追踪，
 * 当字段值变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param name - 要监听的字段路径
 * @param callback - 字段变化时的回调函数；payload 为 `{ value, prevValue }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchField(form, 'email', (_snapshot, payload) => {
 *   const { value, prevValue } = payload
 *   console.log(`${prevValue} -> ${value}`)
 * }, { immediate: true, inequality: true })
 * dispose()
 * ```
 */
export const createWatchField = <
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  name: TName,
  callback: WatchFieldCallback<TValues, TName>,
  options: CreateWatchOptions
): CreateWatchReturn => {
  // 保存上一次 effect 执行时观察到的字段值。
  let prev = form.getFieldSnapshot(name)

  // 区分首次依赖收集与后续变更通知。
  let isFirst = true

  /**
   * 释放用于追踪目标字段的响应式 effect。
   */
  const dispose = form.effect(() => {
    // 读取最新值以建立字段依赖。
    const current = form.getFieldValue(name)

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        const latestSnapshot = form.getFieldsSnapshot()

        runSignalUntracked(() => {
          callback(latestSnapshot, { value: current, prevValue: undefined })
        })
      }

      prev = current

      return
    }

    if (options.inequality && isEqual(current, prev)) return

    const latestSnapshot = form.getFieldsSnapshot()

    runSignalUntracked(() => {
      callback(latestSnapshot, { value: current, prevValue: prev })
    })

    prev = current
  })

  return dispose
}

/**
 * 监听多个字段变化（基于 reactive effect）
 *
 * 在 effect 内调用多个 form.getFieldValue 建立依赖追踪，
 * 当任一被监听字段变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param names - 要监听的字段路径数组
 * @param callback - 字段变化时的回调函数；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (_snapshot, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * }, { inequality: true })
 * dispose()
 * ```
 */
export const createWatchFields = <
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  names: TName[],
  callback: WatchFieldsCallback<TValues>,
  options: CreateWatchOptions
): CreateWatchReturn => {
  // 保存上一次 effect 执行时监听字段的快照。
  let prevValues: Partial<TValues> = form.getFieldsSnapshot(names)

  // 区分首次依赖收集与后续变更通知。
  let isFirst = true

  /**
   * 释放用于追踪全部目标字段的响应式 effect。
   */
  const dispose = form.effect(() => {
    // 读取当前值以建立每个目标字段的依赖。
    const currentValues: Partial<TValues> = form.getFieldsValue(names)

    if (isFirst) {
      isFirst = false

      if (options.immediate) {
        const latestSnapshot = form.getFieldsSnapshot()

        runSignalUntracked(() => {
          callback(latestSnapshot, {
            changedPaths: names,
            changedValues: currentValues,
            prevValues: {},
          })
        })
      }

      prevValues = { ...currentValues }

      return
    }

    if (options.inequality && isEqual(currentValues, prevValues)) return

    // 仅包含相对上一次执行发生变化的部分快照。
    const changedValues = diff<Partial<TValues>>(currentValues, prevValues)

    // 部分变更快照中包含的叶子路径。
    const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

    const latestSnapshot = form.getFieldsSnapshot()

    runSignalUntracked(() => {
      callback(latestSnapshot, { changedPaths, changedValues, prevValues })
    })

    prevValues = { ...currentValues }
  })

  return dispose
}

/**
 * 监听所有字段变化（基于 reactive effect）
 *
 * 在 effect 内调用 form.getFieldsValue() 建立依赖追踪，
 * 当任何字段变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param callback - 字段变化时的回调函数；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchAll(form, (_snapshot, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * }, { immediate: true })
 * dispose()
 * ```
 */
export const createWatchAll = <
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  callback: WatchAllCallback<TValues>,
  options: CreateWatchOptions
): CreateWatchReturn => {
  // 区分首次依赖收集与后续变更通知。
  let isFirst = true

  // 保存上一次 effect 执行时捕获的完整快照。
  let prevValues: TValues = form.getFieldsSnapshot()

  /**
   * 释放用于追踪完整表单快照的响应式 effect。
   */
  const dispose = form.effect(() => {
    form.getFieldsValue()

    // 传递给公开回调的完整快照。
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        runSignalUntracked(() => {
          callback(latestSnapshot, {
            changedPaths: [],
            changedValues: latestSnapshot,
            prevValues: {} as Partial<TValues>,
          })
        })
      }

      prevValues = { ...latestSnapshot }

      return
    }

    if (options.inequality && isEqual(latestSnapshot, prevValues)) return

    // 仅包含相对上一次执行发生变化的部分快照。
    const changedValues = diff<Partial<TValues>>(latestSnapshot, prevValues)

    // 部分变更快照中包含的叶子路径。
    const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

    runSignalUntracked(() => {
      callback(latestSnapshot, { changedPaths, changedValues, prevValues })
    })

    prevValues = { ...latestSnapshot }
  })

  return dispose
}

/**
 * 统一的字段监听函数（基于 reactive effect）
 *
 * 根据参数类型自动分发到 createWatchField / createWatchFields / createWatchAll。
 * 框架适配层可直接调用此函数，无需自行判断参数类型。
 *
 * @param form - 表单实例
 * @param callback - 全局变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatch(form, (values, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues, values)
 * })
 * dispose()
 * ```
 */
export function createWatch<TValues extends Values = Values>(
  form: SchemxInstance<TValues>,
  callback: WatchAllCallback<TValues>,
  options?: CreateWatchOptions
): CreateWatchReturn
/**
 * @param form - 表单实例
 * @param name - 字段路径
 * @param callback - 单字段变化回调；payload 为 `{ value, prevValue }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * createWatch(form, "email", (_values, payload) => {
 *   console.log(payload.prevValue, payload.value)
 * })
 * ```
 */
export function createWatch<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  name: TName,
  callback: WatchFieldCallback<TValues, TName>,
  options?: CreateWatchOptions
): CreateWatchReturn
/**
 * @param form - 表单实例
 * @param names - 字段路径数组
 * @param callback - 多字段变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * createWatch(form, ["firstName", "lastName"], (_values, payload) => {
 *   console.log(payload.changedPaths, payload.changedValues, payload.prevValues)
 * })
 * ```
 */
export function createWatch<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  names: TName[],
  callback: WatchFieldsCallback<TValues>,
  options?: CreateWatchOptions
): CreateWatchReturn
/**
 * createWatch 实现 — 根据第二个参数类型分发到对应的底层函数
 */
export function createWatch<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  nameOrNamesOrCallback: TName | TName[] | WatchAllCallback<TValues>,
  callbackOrOptions?:
    WatchFieldCallback<TValues> | WatchFieldsCallback<TValues> | CreateWatchOptions,
  maybeOptions?: CreateWatchOptions
): CreateWatchReturn {
  // 全局监听：createWatch(form, callback, options?)
  if (typeof nameOrNamesOrCallback === "function") {
    return createWatchAll<TValues>(
      form,
      nameOrNamesOrCallback,
      (callbackOrOptions as CreateWatchOptions) || {}
    )
  }

  // 单字段监听：createWatch(form, name, callback, options?)
  if (
    typeof nameOrNamesOrCallback === "string" ||
    typeof nameOrNamesOrCallback === "number"
  ) {
    return createWatchField<TValues, TName>(
      form,
      nameOrNamesOrCallback as TName,
      callbackOrOptions as WatchFieldCallback<TValues, TName>,
      maybeOptions || {}
    )
  }

  // 多字段监听：createWatch(form, names, callback, options?)
  return createWatchFields<TValues, TName>(
    form,
    nameOrNamesOrCallback as TName[],
    callbackOrOptions as WatchFieldsCallback<TValues>,
    maybeOptions || {}
  )
}
