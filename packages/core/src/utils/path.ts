/**
 * 路径工具函数
 *
 * 基于 es-toolkit/compat 的路径操作，提供嵌套路径的解析和设置功能。
 * 支持点号分隔的路径格式（如 `user.address.city`）和数组路径格式。
 *
 * @module utils/path
 *
 * @example
 * ```typescript
 * import { getByPath, setByPath } from './path'
 *
 * const obj = { user: { address: { city: 'Beijing' } } }
 *
 * // 获取嵌套值
 * getByPath(obj, 'user.address.city') // => 'Beijing'
 *
 * // 设置嵌套值（会自动创建中间对象）
 * setByPath(obj, 'user.profile.name', 'John')
 * // obj => { user: { address: { city: 'Beijing' }, profile: { name: 'John' } } }
 * ```
 */

import { get, set } from "es-toolkit/compat"

import type { FieldValue, NamePath, Values } from "../types"

type RuntimePath = string | number | readonly (string | number)[]

/**
 * 从对象中根据路径获取嵌套值
 *
 * @param obj - 要获取值的源对象
 * @param path - NamePath 路径（string / number / array）
 * @returns 路径对应的值，如果路径不存在则返回 undefined
 *
 * @example
 * ```ts
 * const obj = {
 *   user: {
 *     name: 'John',
 *     address: {
 *       city: 'Beijing',
 *       zip: '100000'
 *     }
 *   },
 *   tags: ['a', 'b', 'c']
 * }
 *
 * // 字符串路径（点号分隔）
 * getByPath(obj, 'user.name')           // => 'John'
 * getByPath(obj, 'user.address.city')   // => 'Beijing'
 *
 * // 数组路径
 * getByPath(obj, ['user', 'name'])      // => 'John'
 * getByPath(obj, ['user', 'address', 'city']) // => 'Beijing'
 *
 * // 数组索引
 * getByPath(obj, ['tags', 0])           // => 'a'
 *
 * // 路径不存在
 * getByPath(obj, 'user.age')            // => undefined
 * ```
 */
export function getByPath<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
>(obj: Partial<TValues>, path: TName): TValue | undefined {
  if (path === "" || (Array.isArray(path) && path.length === 0)) {
    return obj as unknown as TValue
  }

  return get(obj, normalizeRuntimePath(path))
}

/**
 * 在对象中根据路径设置嵌套值
 *
 * @param obj - 要设置值的目标对象
 * @param path - NamePath 路径（string / number / array）
 * @param value - 要设置的值
 *
 * @example
 * ```ts
 * const obj = { user: { name: 'John' } }
 *
 * // 字符串路径
 * setByPath(obj, 'user.name', 'Jane')
 * // obj => { user: { name: 'Jane' } }
 *
 * // 自动创建中间对象
 * setByPath(obj, 'user.address.city', 'Beijing')
 * // obj => { user: { name: 'Jane', address: { city: 'Beijing' } } }
 *
 * // 数组路径
 * setByPath(obj, ['user', 'address', 'zip'], '100000')
 *
 * // 空路径或对象为 null/undefined 时不做操作
 * setByPath(null, 'path', 'value')  // 无操作
 * setByPath(undefined, 'path', 'value')  // 无操作
 * ```
 */
export function setByPath<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
>(obj: Partial<TValues>, path: TName, value: TValue): void {
  if (obj == null) return

  set(obj, normalizeRuntimePath(path), value)
}

/**
 * 从对象中递归收集所有叶子节点路径。
 *
 * 只返回叶子路径，不包含中间对象/数组节点。
 *
 * @param obj - 要收集路径的对象
 * @param prefix - 路径前缀（内部递归用）
 * @returns 所有叶子节点路径数组
 *
 * @example
 * ```typescript
 * collectObjectPathsByLeaf({ name: 'a', age: 25 })
 * // => ['name', 'age']
 *
 * collectObjectPathsByLeaf({ name: 'a', address: { city: 'BJ', zip: '100000' } })
 * // => ['name', 'address.city', 'address.zip']
 * ```
 */
export function collectObjectPathsByLeaf<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(obj: Partial<TValues>, prefix = ""): TName[] {
  const paths: TName[] = []

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (Array.isArray(value)) {
      value.forEach((item: unknown, index: number) => {
        const itemPath = `${path}[${index}]` as TName
        if (item !== null && typeof item === "object") {
          paths.push(...(collectObjectPathsByLeaf(item, itemPath as string) as TName[]))
        } else {
          paths.push(itemPath)
        }
      })
    } else if (value !== null && typeof value === "object") {
      paths.push(...(collectObjectPathsByLeaf(value, path) as TName[]))
    } else {
      paths.push(path as TName)
    }
  }

  return paths
}

/**
 * 规范化字段路径，保证字符串路径和数组路径落到同一个索引键。
 *
 * @param path - 字段路径。
 * @returns 规范化后的点号路径字符串。
 *
 * @example
 * ```typescript
 * normalizeNamePath(['user', 'name']) // => 'user.name'
 * normalizeNamePath('user[0].name')   // => 'user.0.name'
 * ```
 */
export function normalizeNamePath<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(path: TName[]): string {
  if (Array.isArray(path)) {
    return path.map((part) => String(part)).join(".")
  }

  return String(path)
    .replace(/\[(.*?)\]/g, ".$1")
    .replace(/^\./, "")
}

const normalizeRuntimePath = (path: NamePath): RuntimePath => {
  if (Array.isArray(path)) {
    return path.map((part) => (typeof part === "number" ? part : String(part)))
  }

  return path as string | number
}
