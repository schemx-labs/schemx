/**
 * TypeScript 工具类型
 *
 * 提供类型层面的辅助工具，用于增强类型安全性。
 *
 * @module types/utils
 */

import type * as CSS from "csstype"

/**
 * 原始类型联合。
 */
type Primitive = string | number | boolean | bigint | symbol | null | undefined

/**
 * 内置类型联合，包括原始类型、函数、Date、Error、RegExp。
 */
type Builtin = Primitive | CallableFunction | NewableFunction | Date | Error | RegExp

/**
 * 深层只读工具类型。
 *
 * 递归地将对象、数组、元组、Map、Set、Promise 中的成员转换为只读结构，
 * 用于表达“调用方不应修改这份数据”的类型约束。
 *
 * 处理规则：
 * - 原始类型、函数、Date、Error、RegExp 保持原类型
 * - Map / ReadonlyMap 转换为 ReadonlyMap，并递归处理 key/value
 * - Set / ReadonlySet 转换为 ReadonlySet，并递归处理元素
 * - Promise 递归处理 resolved value
 * - tuple 保留 tuple 结构，并递归只读化每一项
 * - array 转换为 readonly array，并递归处理元素
 * - 普通对象递归将所有属性标记为 readonly
 *
 * 注意：这是 TypeScript 类型层面的只读约束，不会在运行时调用
 * `Object.freeze()`，也不会阻止通过类型断言或原始引用修改对象。
 *
 * @typeParam TValue - 需要转换为深层只读的目标类型
 *
 * @example
 * ```ts
 * interface User {
 *   name: string
 *   profile: {
 *     tags: string[]
 *   }
 *   permissions: Map<string, { enabled: boolean }>
 * }
 *
 * type ReadonlyUser = DeepReadonly<User>
 * // {
 * //   readonly name: string
 * //   readonly profile: {
 * //     readonly tags: readonly string[]
 * //   }
 * //   readonly permissions: ReadonlyMap<string, { readonly enabled: boolean }>
 * // }
 * ```
 */
export type DeepReadonly<TValue> = TValue extends Builtin
  ? TValue
  : TValue extends ReadonlyMap<infer TKey, infer TMapValue>
    ? ReadonlyMap<DeepReadonly<TKey>, DeepReadonly<TMapValue>>
    : TValue extends ReadonlySet<infer TItem>
      ? ReadonlySet<DeepReadonly<TItem>>
      : TValue extends Promise<infer TResult>
        ? Promise<DeepReadonly<TResult>>
        : TValue extends readonly unknown[]
          ? number extends TValue["length"]
            ? readonly DeepReadonly<TValue[number]>[]
            : {
                readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]>
              }
          : TValue extends object
            ? {
                readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]>
              }
            : TValue

/**
 * CSS 样式属性类型
 *
 * 基于 csstype 的完整 CSS 属性定义，提供类型安全的样式声明。
 *
 * @example
 * ```ts
 * const style: CSSProperties = {
 *   color: 'red',
 *   fontSize: '14px',
 *   lineHeight: 1.5,
 * }
 * ```
 */
export type CSSProperties = CSS.Properties
