/**
 * 动态属性解析工具
 *
 * 支持将函数类型或静态值统一解析为最终属性值，
 * 用于 schemx 列配置中的动态属性（如 disabled、visible、placeholder 等）。
 *
 * 提供两个核心函数：
 * - {@link resolveDependencie} — 解析单个动态属性
 * - {@link batchResolveDependencie} — 创建 debounced 批量解析器，合并高频调用
 *
 * @module utils/dynamic
 */

import { debounce } from "es-toolkit"

import type { Dynamic } from "@schemx/core"
import type { Values } from "@schemx/core"

/**
 * 批量解析的单个属性条目
 *
 * @typeParam T - 属性值类型
 */
export interface DependencieEntry<T> {
  /** 动态属性值（函数、静态值、null 或 undefined） */
  value: Dynamic<T> | undefined | null
  /** 默认值，当 value 为空或函数返回 nullish 时使用 */
  defaultValue: T
}

/**
 * 批量解析的属性条目映射表类型
 *
 * 将属性名映射到对应的 {@link DependencieEntry}。
 *
 * @typeParam M - 属性名到值类型的映射
 */
type DependencieEntries<M extends Record<string, unknown>> = {
  [K in keyof M]: DependencieEntry<M[K]>
}

/**
 * 解析泛型动态属性
 *
 * 将 `Dynamic<T>`（函数或静态值）统一解析为 `T`。
 * 当 value 为函数时调用并传入表单值，捕获错误返回默认值；
 * 当 value 为 null/undefined 时返回默认值。
 *
 * @typeParam T - 解析后的属性值类型
 *
 * @param value - 动态属性值（函数、静态值、null 或 undefined）
 * @param formValues - 当前表单值，作为函数形式的入参
 * @param defaultValue - 默认值，当 value 为空或函数返回 nullish 时使用
 *
 * @returns 解析后的属性值，类型始终为 T
 *
 * @example
 * ```typescript
 * // 函数类型
 * await resolveDependencie((v) => v.name, { name: 'test' }, '')
 * // => 'test'
 *
 * // 静态值
 * await resolveDependencie('hello', {}, '')
 * // => 'hello'
 *
 * // null/undefined 回退到默认值
 * await resolveDependencie(undefined, {}, 'default')
 * // => 'default'
 * ```
 */
export async function resolveDependencie<T>(
  value: Dynamic<T> | undefined | null,
  formValues: Values,
  defaultValue: T
): Promise<T> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await (value as (values: Values) => T | Promise<T>)(formValues)

      return result ?? defaultValue
    } catch (error) {
      console.error("[schemx] 解析动态属性时发生错误:", error)

      return defaultValue
    }
  }

  return value
}

/**
 * 创建 debounced 批量动态属性解析器
 *
 * 返回一个函数，每次调用时传入属性配置映射表、表单值和回调。
 * 高频调用时只保留最后一次的参数，debounce 窗口结束后一次性
 * 通过 `Promise.all` 并行解析所有属性，将结果通过回调分发。
 *
 * @typeParam M - 属性名到值类型的映射
 *
 * @param wait - debounce 等待时间（毫秒），默认 16ms（约一帧）
 *
 * @returns debounced 批量解析函数
 *
 * @example
 * ```typescript
 * const resolve = batchResolveDependencie<{
 *   visible: boolean
 *   disabled: boolean
 *   placeholder: string
 * }>()
 *
 * // 在 watch 回调中调用，高频触发时只执行最后一次
 * resolve(
 *   {
 *     visible:     { value: schema.visible, defaultValue: true },
 *     disabled:    { value: schema.disabled, defaultValue: false },
 *     placeholder: { value: schema.placeholder, defaultValue: '' },
 *   },
 *   latestSnapshot,
 *   (results) => {
 *     resolvedVisible.value = results.visible
 *     resolvedDisabled.value = results.disabled
 *     resolvedPlaceholder.value = results.placeholder
 *   }
 * )
 * ```
 *
 * @remarks
 * 内部使用 es-toolkit 的 debounce 实现调用合并。
 * 适用于 signal effect / watch 回调中批量解析动态属性的场景，
 * 避免多个字段同时变化时重复解析。
 */
export function batchResolveDependencie<M extends Record<string, unknown>>(
  wait = 16
): (
  entries: DependencieEntries<M>,
  formValues: Values,
  callback: (results: M) => void
) => void {
  let pending: {
    entries: DependencieEntries<M>
    formValues: Values
    callback: (results: M) => void
  } | null = null

  const flush = debounce(async () => {
    if (!pending) return

    const { entries, formValues, callback } = pending
    pending = null

    const keys = Object.keys(entries) as (keyof M & string)[]
    const promises = keys.map((key) =>
      resolveDependencie(entries[key].value, formValues, entries[key].defaultValue)
    )

    const values = await Promise.all(promises)

    const results = {} as M
    keys.forEach((key, i) => {
      ;(results as any)[key] = values[i]
    })

    callback(results)
  }, wait)

  return (entries, formValues, callback) => {
    pending = { entries, formValues, callback }
    flush()
  }
}
