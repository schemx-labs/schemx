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
 * 所有回调采用 payload 模式：`(payload, latestSnapshot)`，
 * payload 包含变更的详细信息，latestSnapshot 为变更后的表单完整快照。
 *
 * @module core/createWatch
 *
 * @example
 * ```ts
 * import { createWatch, createWatchField, createWatchFields, createWatchAll } from '@schemx/core'
 *
 * // 统一入口 — 根据参数类型自动分发
 * createWatch(form, 'username', (payload, snapshot) => { ... })
 * createWatch(form, ['firstName', 'lastName'], (payload, snapshot) => { ... })
 * createWatch(form, (payload, snapshot) => { ... })
 *
 * // 监听单个字段
 * const dispose = createWatchField(form, 'username', (payload, snapshot) => {
 *   console.log(`${payload.prevValue} -> ${payload.value}`)
 * }, { immediate: true })
 *
 * // 监听多个字段
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (payload, snapshot) => {
 *   console.log('changed:', payload.changedValues)
 * }, {})
 *
 * // 监听所有字段
 * const dispose = createWatchAll(form, (payload, snapshot) => {
 *   console.log('changed paths:', payload.changedPaths)
 * }, {})
 *
 * // 取消监听
 * dispose()
 * ```
 */

import { isEqual } from "es-toolkit/compat"

import { collectObjectPathsByLeaf, diff } from "./utils"

import type { FieldValue, NamePath, SchemxInstance, Values } from "./types"

/** 单字段订阅回调的载荷 */
type FieldPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /** 变更后的字段值 */
  value: FieldValue<TValues, TName> | undefined
  /** 变更前的字段值 */
  prevValue: FieldValue<TValues, TName> | undefined
}

/** 多字段订阅回调的载荷 */
type FieldsPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /** 本次变更涉及的所有字段路径 */
  changedPaths: TName[]
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: Partial<TValues>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: Partial<TValues>
}

/** 全局订阅回调的载荷 */
type GlobalPayload<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = {
  /** 本次变更涉及的所有字段路径 */
  changedPaths: TName[]
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: Partial<TValues>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: Partial<TValues>
}

/**
 * 订阅回调的基础类型。
 *
 * 回调接收两个参数：变更载荷（payload）和变更后的表单完整快照（latestSnapshot）。
 */
type BaseSubscribeCallback<TValues, P> = (payload: P, latestSnapshot: TValues) => void

/**
 * 单字段订阅回调类型。
 *
 * payload 包含目标字段的新旧值，第二个参数是最新表单快照。
 */
export type WatchFieldCallback<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = BaseSubscribeCallback<TValues, FieldPayload<TValues, TName>>

/**
 * 多字段订阅回调类型。
 *
 * payload 只包含被监听字段集合内发生变化的路径和值。
 */
export type WatchFieldsCallback<TValues extends Values> = BaseSubscribeCallback<
  TValues,
  FieldsPayload<TValues>
>

/**
 * 全局订阅回调类型。
 *
 * payload 包含任意字段变化后计算出的 changedPaths、changedValues 和 prevValues。
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
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchField(form, 'email', (payload, snapshot) => {
 *   console.log(`${payload.path}: ${payload.prevValue} -> ${payload.value}`)
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
  let prev = form.getFieldSnapshot(name)

  let isFirst = true

  const dispose = form.effect(() => {
    const current = form.getFieldValue(name)
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        callback({ value: current, prevValue: undefined }, latestSnapshot)
      }

      prev = current

      return
    }

    if (options.inequality && isEqual(current, prev)) return

    callback({ value: current, prevValue: prev }, latestSnapshot)

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
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (payload, snapshot) => {
 *   console.log('changed:', payload.changedValues)
 *   console.log('prev:', payload.prevValues)
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
  let prevValues: Partial<TValues> = form.getFieldsSnapshot(names)
  let isFirst = true

  const dispose = form.effect(() => {
    const currentValues: Partial<TValues> = form.getFieldsValue(names)
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false

      if (options.immediate) {
        callback(
          { changedPaths: names, changedValues: currentValues, prevValues: {} },
          latestSnapshot
        )
      }

      prevValues = { ...currentValues }

      return
    }

    if (options.inequality && isEqual(currentValues, prevValues)) return

    const changedValues = diff<Partial<TValues>>(currentValues, prevValues)
    const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

    callback({ changedPaths, changedValues, prevValues }, latestSnapshot)

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
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchAll(form, (payload, snapshot) => {
 *   console.log('changed paths:', payload.changedPaths)
 *   console.log('changed values:', payload.changedValues)
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
  let isFirst = true
  let prevValues: TValues = form.getFieldsSnapshot()

  const dispose = form.effect(() => {
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        callback(
          {
            changedPaths: [],
            changedValues: latestSnapshot,
            prevValues: {} as Partial<TValues>,
          },
          latestSnapshot
        )
      }

      prevValues = { ...latestSnapshot }

      return
    }

    if (options.inequality && isEqual(latestSnapshot, prevValues)) return

    const changedValues = diff<Partial<TValues>>(latestSnapshot, prevValues)
    const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

    callback({ changedPaths, changedValues, prevValues }, latestSnapshot)

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
 * @param callback - 全局变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
 */
export function createWatch<TValues extends Values = Values>(
  form: SchemxInstance<TValues>,
  callback: WatchAllCallback<TValues>,
  options?: CreateWatchOptions
): CreateWatchReturn
/**
 * @param form - 表单实例
 * @param name - 字段路径
 * @param callback - 单字段变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
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
 * @param callback - 多字段变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
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
    | WatchFieldCallback<TValues>
    | WatchFieldsCallback<TValues>
    | CreateWatchOptions,
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
