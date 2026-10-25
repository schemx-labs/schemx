/**
 * useWatch - 监听字段变化（Vue 组合式 API 版本）
 *
 * 基于 core 层的 {@link createWatch} 实现，
 * 自动读取祖先提供的表单实例，
 * 并在当前 Vue effect scope 停止时自动取消监听。
 *
 * 提供三种监听模式：
 * - 全局监听：`useWatch(callback, options?)` — 监听表单中任意字段变化
 * - 单字段监听：`useWatch(name, callback, options?)` — 监听指定字段变化
 * - 多字段监听：`useWatch(names, callback, options?)` — 监听一组字段变化
 *
 * 同时提供语义化的便捷方法：
 * - {@link useWatchField} — 单字段监听
 * - {@link useWatchFields} — 多字段监听
 * - {@link useWatchAll} — 全局监听
 *
 * @module hooks/useWatch
 *
 * @example
 * ```ts
 * // 全局监听
 * useWatch((snapshot, payload) => {
 *   console.log('form changed:', snapshot, payload)
 * })
 *
 * // 单字段监听
 * useWatch('username', (_snapshot, { value, prevValue }) => {
 *   console.log('username changed:', prevValue, '->', value)
 * }, { immediate: true })
 *
 * // 多字段监听
 * useWatch(['firstName', 'lastName'], (_snapshot, payload) => {
 *   console.log('name changed:', payload.changedValues)
 * }, { inequality: true })
 * ```
 */

import { getCurrentScope, onScopeDispose } from "vue"

import { createWatch } from "@schemx/core"

import { readFormContextInstance } from "../context"

import type {
  CreateWatchOptions,
  NamePath,
  Values,
  WatchAllCallback,
  WatchFieldCallback,
  WatchFieldsCallback,
} from "@schemx/core"

/**
 * 监听所有字段变化
 *
 * @typeParam TValues - 表单值类型。
 * @param callback - 全局变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = useWatch((values, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues, values)
 * })
 * ```
 */
export function useWatch<TValues extends Values>(
  callback: WatchAllCallback<TValues>,
  options?: CreateWatchOptions
): () => void
/**
 * 监听单个字段变化
 *
 * @typeParam TValues - 表单值类型。
 * @param name - 字段路径
 * @param callback - 单字段变化回调；payload 为 `{ value, prevValue }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatch("email", (_values, payload) => {
 *   console.log(payload.prevValue, payload.value)
 * })
 * ```
 */
export function useWatch<TValues extends Values>(
  name: NamePath<TValues>,
  callback: WatchFieldCallback<TValues>,
  options?: CreateWatchOptions
): () => void
/**
 * 监听多个字段变化
 *
 * @typeParam TValues - 表单值类型。
 * @param names - 字段路径数组
 * @param callback - 多字段变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatch(["firstName", "lastName"], (_values, payload) => {
 *   console.log(payload.changedPaths, payload.changedValues, payload.prevValues)
 * })
 * ```
 */
export function useWatch<TValues extends Values>(
  names: NamePath<TValues>[],
  callback: WatchFieldsCallback<TValues>,
  options?: CreateWatchOptions
): () => void
/**
 * useWatch 实现 — 获取 form 实例后委托给 core 层的 createWatch
 *
 * @typeParam TValues - 表单值类型。
 */
export function useWatch<TValues extends Values>(
  nameOrNamesOrCallback:
    NamePath<TValues> | NamePath<TValues>[] | WatchAllCallback<TValues>,
  callbackOrOptions?:
    WatchFieldCallback<TValues> | WatchFieldsCallback<TValues> | CreateWatchOptions,
  maybeOptions?: CreateWatchOptions
): () => void {
  const scope = getCurrentScope()

  if (!scope?.active) {
    throw new Error("[schemx] useWatch() requires an active Vue scope.")
  }

  const form = readFormContextInstance<TValues>()

  let dispose: () => void

  if (typeof nameOrNamesOrCallback === "function") {
    dispose = createWatch(
      form,
      nameOrNamesOrCallback,
      typeof callbackOrOptions === "function" ? undefined : callbackOrOptions
    )
  } else if (Array.isArray(nameOrNamesOrCallback)) {
    // 重载约定路径数组与多字段回调成对传入。
    dispose = createWatch(
      form,
      nameOrNamesOrCallback,
      callbackOrOptions as WatchFieldsCallback<TValues>,
      maybeOptions
    )
  } else {
    dispose = createWatch(
      form,
      nameOrNamesOrCallback,
      callbackOrOptions as WatchFieldCallback<TValues>,
      maybeOptions
    )
  }

  // immediate 回调可能同步停止当前 scope，已创建的 Core 订阅仍须释放。
  if (scope.active) {
    onScopeDispose(dispose)
  } else {
    dispose()
  }

  return dispose
}

/**
 * 监听单个字段变化的便捷方法
 *
 * 等价于 `useWatch(name, callback, options)`，语义更明确。
 * 自动绑定 formContext 并在当前 scope 停止时取消监听。
 *
 * @typeParam TValues - 表单值类型。
 * @param name - 要监听的字段路径
 * @param callback - 字段变化回调；payload 为 `{ value, prevValue }`
 * @param options - 可选配置
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatchField("email", (_values, payload) => {
 *   const { value, prevValue } = payload
 *   console.log(prevValue, value)
 * })
 * ```
 */
export function useWatchField<TValues extends Values = Values>(
  name: NamePath<TValues>,
  callback: WatchFieldCallback<TValues>,
  options?: CreateWatchOptions
): () => void {
  return useWatch<TValues>(name, callback, options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * 等价于 `useWatch(names, callback, options)`，语义更明确。
 * 自动绑定 formContext 并在当前 scope 停止时取消监听。
 *
 * @typeParam TValues - 表单值类型。
 * @param names - 要监听的字段路径数组
 * @param callback - 字段变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 可选配置
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatchFields(["firstName", "lastName"], (_values, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * })
 * ```
 */
export function useWatchFields<TValues extends Values>(
  names: NamePath<TValues>[],
  callback: WatchFieldsCallback<TValues>,
  options?: CreateWatchOptions
): () => void {
  return useWatch<TValues>(names, callback, options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, options)`，语义更明确。
 * 自动绑定 formContext 并在当前 scope 停止时取消监听。
 *
 * @typeParam TValues - 表单值类型。
 * @param callback - 全局变化回调；payload 为 `{ changedPaths, changedValues, prevValues }`
 * @param options - 可选配置
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatchAll((_values, payload) => {
 *   const { changedPaths, changedValues, prevValues } = payload
 *   console.log(changedPaths, changedValues, prevValues)
 * })
 * ```
 */
export function useWatchAll<TValues extends Values = Values>(
  callback: WatchAllCallback<TValues>,
  options?: CreateWatchOptions
): () => void {
  return useWatch(callback, options)
}

export default useWatch
