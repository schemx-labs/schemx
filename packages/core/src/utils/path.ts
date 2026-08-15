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

import { get, set, toPath } from "es-toolkit/compat"

import type { FieldValue, NamePath, Values } from "../types"

/** es-toolkit 路径函数接受的运行时路径形态。 */
type RuntimePath = string | number | readonly (string | number)[]

/**
 * 可用于 Map、Scheduler 等身份比较场景的稳定字段路径 key。
 *
 * 该类型只在编译期区分普通字符串；运行时值是以 JSON 编码的路径段数组。
 */
export type FieldKey = string & { readonly __fieldKey: unique symbol }

/**
 * 判断两组字段路径是否按顺序完全一致。
 *
 * @param previous - 上一组字段路径。
 * @param next - 下一组字段路径。
 * @returns 路径数量、顺序和每段内容都一致时返回 true。
 */
export function areNamePathListsEqual<TValues extends Values>(
  previous: readonly NamePath<TValues>[],
  next: readonly NamePath<TValues>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((path, index) => isNamePathEqual(path, next[index]))
}

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
>(path: TName): string {
  return toNamePathSegments(path).join(".")
}

/**
 * 将任意 NamePath 解析为用于身份比较的字符串路径段。
 *
 * 字符串路径使用与 `getByPath` 相同的 compat parser；数组路径保留调用方给出的
 * 段边界，因此 `["user.name"]` 不会与 `"user.name"` 错误合并。
 *
 * @param path - 要解析的字段路径。
 * @returns 只读的规范化路径段数组。
 */
export function toNamePathSegments<TValues extends Values = Values>(
  path: NamePath<TValues>
): readonly string[] {
  const segments = Array.isArray(path) ? path : toPath(String(path))

  return segments.map((part) => String(part))
}

/**
 * 判断 candidate 是否位于 ancestor 的严格后代路径。
 *
 * @param candidate - 待判断的字段路径。
 * @param ancestor - 作为祖先路径的字段路径。
 * @returns candidate 是否是 ancestor 的严格后代。
 */
export function isDescendantFieldPath<TValues extends Values>(
  candidate: NamePath<TValues>,
  ancestor: NamePath<TValues>
): boolean {
  const candidateSegments = toNamePathSegments(candidate)
  const ancestorSegments = toNamePathSegments(ancestor)

  return (
    candidateSegments.length > ancestorSegments.length &&
    ancestorSegments.every((segment, index) => segment === candidateSegments[index])
  )
}

/**
 * 判断两个字段路径是否存在父子关系。
 *
 * @param first - 第一个字段路径。
 * @param second - 第二个字段路径。
 * @returns 两个路径是否互为父路径和严格后代路径。
 */
export function areOverlappingFieldPaths<TValues extends Values>(
  first: NamePath<TValues>,
  second: NamePath<TValues>
): boolean {
  return isDescendantFieldPath(first, second) || isDescendantFieldPath(second, first)
}

/**
 * 创建碰撞安全的字段身份 key。
 *
 * @param path - 要标识的字段路径。
 * @returns 可安全用于 Map key、Set key 和 Scheduler task id 的稳定 key。
 */
export function createFieldKey<TValues extends Values = Values>(
  path: NamePath<TValues>
): FieldKey {
  return JSON.stringify(toNamePathSegments(path)) as FieldKey
}

/**
 * 将 NamePath 统一转为 es-toolkit 运行时接受的路径格式。
 *
 * 数组路径转换成 `(string|number)[]` 格式（保留数字索引），
 * 字符串路径保持原样。
 *
 * @param path - 字段路径（字符串或数组）
 * @returns 标准化后的运行时路径，适配 es-toolkit 的 get/set 接口
 */
/** 将类型安全的 NamePath 转换为路径库可消费的运行时路径。 */
const normalizeRuntimePath = (path: NamePath): RuntimePath => {
  if (Array.isArray(path)) {
    return path.map((part) => (typeof part === "number" ? part : String(part)))
  }

  return path as string | number
}

/** 比较两个字段路径的段数、顺序和每一段内容。 */
function isNamePathEqual<TValues extends Values>(
  previous: NamePath<TValues>,
  next: NamePath<TValues> | undefined
): boolean {
  if (next === undefined) {
    return false
  }

  return createFieldKey(previous) === createFieldKey(next)
}
