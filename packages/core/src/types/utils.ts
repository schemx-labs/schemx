/**
 * TypeScript 工具类型
 *
 * 提供类型层面的辅助工具，用于增强类型安全性。
 *
 * @module types/utils
 */

import type * as CSS from "csstype"

/**
 * 精确类型约束，禁止对象字面量中出现目标类型未定义的属性。
 *
 * TypeScript 的多余属性检查在展开运算符场景下可能失效，
 * 此工具类型通过将未知 key 映射为 never 来强制报错。
 *
 * @typeParam T - 目标类型
 * @typeParam U - 实际传入的类型，必须是 T 的子类型
 *
 * @example
 * ```ts
 * interface Props { name: string; age: number }
 *
 * function create<T extends Props>(props: Exact<Props, T>): Props {
 *   return props
 * }
 *
 * create({ name: "test", age: 18 })          // 正常
 * create({ name: "test", age: 18, x: true }) // 报错：x 不能赋值给 never
 * ```
 */
export type Exact<T, U extends T> = T & Record<Exclude<keyof U, keyof T>, never>

type Primitive = string | number | boolean | bigint | symbol | null | undefined

// eslint-disable-next-line @typescript-eslint/ban-types
type Builtin = Primitive | Function | Date | Error | RegExp

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
 * @typeParam T - 需要转换为深层只读的目标类型
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
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends ReadonlyMap<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlySet<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends Promise<infer U>
        ? Promise<DeepReadonly<U>>
        : T extends readonly unknown[]
          ? number extends T["length"]
            ? readonly DeepReadonly<T[number]>[]
            : {
                readonly [K in keyof T]: DeepReadonly<T[K]>
              }
          : T extends object
            ? {
                readonly [K in keyof T]: DeepReadonly<T[K]>
              }
            : T

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
