/**
 * 对象浅层 diff 工具
 *
 * 对比两个对象并返回变化属性的新值。
 *
 * 使用 `isEqual`（来自 es-toolkit）进行深度比较。
 *
 * @module utils/diff
 */

import { isEqual } from "es-toolkit/compat"

/**
 * 对比两个对象的顶层属性，仅返回变化的属性新值。
 *
 * 遍历 current 的所有 key，与 prev 逐一深度比较，
 * 收集不相等的 key 对应的新值。
 *
 * @typeParam TRecord - 对象类型
 *
 * @param current - 当前对象
 * @param prev - 上一次对象
 *
 * @returns 变化的属性新值（部分对象）
 *
 * @example
 * ```typescript
 * const changed = diff({ a: 1, b: 2 }, { a: 1, b: 3 })
 * // changed => { b: 2 }
 * ```
 */
export function diff<TRecord extends Record<string, unknown>>(
  current: TRecord,
  prev: TRecord
): Partial<TRecord> {
  const changedValues: Partial<TRecord> = {}

  for (const key of Object.keys(current) as (keyof TRecord)[]) {
    if (!isEqual(current[key], prev[key])) {
      changedValues[key] = current[key]
    }
  }

  return changedValues
}
