/**
 * useWatch - 监听字段变化（Vue 组合式 API 版本）
 *
 * 基于 core 层的 {@link createWatch} 实现，
 * 自动通过 `useFormInstance` 获取 formContext，
 * 并在 `onUnmounted` 时自动取消监听，无需手动管理生命周期。
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
 * useWatch((snapshot) => {
 *   console.log('form changed:', snapshot)
 * })
 *
 * // 单字段监听
 * useWatch('username', (current, prev) => {
 *   console.log('username changed:', prev, '->', current)
 * }, { immediate: true })
 *
 * // 多字段监听
 * useWatch(['firstName', 'lastName'], (currentValues, prevValues) => {
 *   console.log('name changed:', currentValues)
 * }, { inequality: true })
 * ```
 */

import { onUnmounted } from "vue"

import { createWatch } from "@schemx/core"

import { useFormInstance } from "./useForm"

import type { NamePath, Values } from "@schemx/core"
import type {
  CreateWatchOptions,
  WatchAllCallback,
  WatchFieldCallback,
  WatchFieldsCallback,
} from "@schemx/core"

/**
 * 监听所有字段变化
 *
 * @param callback - 全局变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
 */
export function useWatch<T extends Values>(
  callback: WatchAllCallback<T>,
  options?: CreateWatchOptions
): () => void
/**
 * 监听单个字段变化
 *
 * @param name - 字段路径
 * @param callback - 单字段变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
 */
export function useWatch<T extends Values>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: CreateWatchOptions
): () => void
/**
 * 监听多个字段变化
 *
 * @param names - 字段路径数组
 * @param callback - 多字段变化回调
 * @param options - 监听选项
 * @returns 取消监听函数
 */
export function useWatch<T extends Values>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: CreateWatchOptions
): () => void
/**
 * useWatch 实现 — 获取 form 实例后委托给 core 层的 createWatch
 */
export function useWatch<T extends Values>(
  nameOrNamesOrCallback: NamePath<T> | NamePath<T>[] | WatchAllCallback<T>,
  callbackOrOptions?: WatchFieldCallback<T> | WatchFieldsCallback<T> | CreateWatchOptions,
  maybeOptions?: CreateWatchOptions
): () => void {
  const form = useFormInstance<T>()

  const dispose = (createWatch as any)(
    form,
    nameOrNamesOrCallback,
    callbackOrOptions,
    maybeOptions
  )

  onUnmounted(dispose)

  return dispose
}

/**
 * 监听单个字段变化的便捷方法
 *
 * 等价于 `useWatch(name, callback, options)`，语义更明确。
 * 自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param name - 要监听的字段路径
 * @param callback - 字段变化回调
 * @param options - 可选配置
 * @returns 取消监听函数
 */
export function useWatchField<T extends Values = Values>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: CreateWatchOptions
): () => void {
  return useWatch<T>(name, callback, options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * 等价于 `useWatch(names, callback, options)`，语义更明确。
 * 自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param names - 要监听的字段路径数组
 * @param callback - 字段变化回调
 * @param options - 可选配置
 * @returns 取消监听函数
 */
export function useWatchFields<T extends Values>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: CreateWatchOptions
): () => void {
  return useWatch<T>(names, callback, options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, options)`，语义更明确。
 * 自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param callback - 全局变化回调
 * @param options - 可选配置
 * @returns 取消监听函数
 */
export function useWatchAll<T extends Values = Values>(
  callback: WatchAllCallback<T>,
  options?: CreateWatchOptions
): () => void {
  return useWatch(callback, options)
}

export default useWatch
