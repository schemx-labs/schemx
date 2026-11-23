/**
 * 深层路径类型工具。
 *
 * 提供类型安全的嵌套对象路径推导，用于表单字段路径约束。
 *
 * @module types/namePathType
 */

/** 基础路径类型，支持字符串、数字、布尔值及其数组组合 */
type BaseNamePath = string | number | boolean | (string | number | boolean)[]

/**
 * 深层路径类型推导。
 *
 * 根据 Store 类型递归推导所有合法的字段访问路径，
 * 支持嵌套对象、数组索引，最大递归深度为 5 层。
 *
 * @typeParam Store - 表单数据类型
 * @typeParam ParentNamePath - 父级路径元组，由递归自动生成，无需手动传入
 *
 * @example
 * ```ts
 * interface FormData {
 *   user: {
 *     name: string
 *     address: { city: string }
 *   }
 *   tags: string[]
 * }
 *
 * // 合法路径：'user' | ['user', 'name'] | ['user', 'address'] | ['user', 'address', 'city'] | 'tags' | ['tags', number]
 * type Path = DeepNamePathArray<FormData>
 * ```
 *
 * @remarks
 * - 递归深度限制为 5 层，超出后返回 `never`
 * - 顶层路径支持单独的 key 字符串（如 `'user'`），嵌套路径使用元组（如 `['user', 'name']`）
 * - 数组类型的子路径使用 `number` 作为索引
 * - 函数类型的属性会被排除
 */
export type DeepNamePathArray<
  Store = any,
  ParentNamePath extends any[] = [],
> = ParentNamePath["length"] extends 5
  ? never
  : // 判断 Store 是否为基础类型
    true extends (Store extends BaseNamePath ? true : false)
    ? ParentNamePath["length"] extends 0
      ? Store | BaseNamePath // 顶层直接返回 BaseNamePath
      : Store extends any[]
        ? [...ParentNamePath, number] // 数组类型拼接数字索引
        : never
    : Store extends any[] // 判断 Store 是否为数组
      ? // 数组路径：如 { a: { b: string }[] }
          // 推导出：[a] | [a, number] | [a, number, b]
          | [...ParentNamePath, number]
          | DeepNamePathArray<Store[number], [...ParentNamePath, number]>
      : keyof Store extends never // unknown 类型兜底
        ? Store
        : {
            // 遍历 Store 的每个属性
            // eslint-disable-next-line @typescript-eslint/ban-types
            [FieldKey in keyof Store]: Store[FieldKey] extends Function
              ? never // 排除函数类型属性
              :
                  | (ParentNamePath["length"] extends 0 ? FieldKey : never) // 顶层允许单独使用 key
                  | [...ParentNamePath, FieldKey] // 拼接父级路径
                  | DeepNamePathArray<
                      Required<Store>[FieldKey],
                      [...ParentNamePath, FieldKey]
                    > // 递归子属性
          }[keyof Store]

/**
 * 点号分隔的深层路径字符串类型推导。
 *
 * 根据 Store 类型递归推导所有合法的点号分隔字段路径字符串，
 * 支持嵌套对象、数组索引，最大递归深度为 5 层。
 *
 * @typeParam Store - 表单数据类型
 * @typeParam Prefix - 当前路径前缀，由递归自动生成，无需手动传入
 * @typeParam Depth - 递归深度计数元组，由递归自动生成，无需手动传入
 *
 * @example
 * ```ts
 * interface FormData {
 *   user: {
 *     name: string
 *     address: { city: string }
 *   }
 *   tags: string[]
 * }
 *
 * // 合法路径：'user' | 'user.name' | 'user.address' | 'user.address.city' | 'tags' | `tags.${number}`
 * type Path = DeepNamePath<FormData>
 * ```
 *
 * @remarks
 * - 递归深度限制为 5 层，超出后返回 `never`
 * - 使用点号（`.`）连接各层路径
 * - 数组类型的子路径使用 `${number}` 作为索引（如 `tags.0`）
 * - 函数类型的属性会被排除
 */
export type DeepNamePath<
  Store = any,
  Prefix extends string = "",
  Depth extends any[] = [],
> = Depth["length"] extends 5
  ? never
  : Store extends any[]
    ? // 数组路径：拼接数字索引并递归元素类型
        | (Prefix extends "" ? `${number}` : `${Prefix}.${number}`)
        | DeepNamePath<
            Store[number],
            Prefix extends "" ? `${number}` : `${Prefix}.${number}`,
            [...Depth, 1]
          >
    : Store extends object
      ? {
          // eslint-disable-next-line @typescript-eslint/ban-types
          [K in keyof Store & string]: Store[K] extends Function
            ? never // 排除函数类型属性
            : // 当前 key 路径
                | (Prefix extends "" ? K : `${Prefix}.${K}`)
                // 递归子属性
                | DeepNamePath<
                    Required<Store>[K],
                    Prefix extends "" ? K : `${Prefix}.${K}`,
                    [...Depth, 1]
                  >
        }[keyof Store & string]
      : never

/**
 * 从当前层类型中提取字符串路径片段对应的值类型。
 */
type StringPathSegmentValue<T, K extends string> = K extends keyof NonNullable<T>
  ? NonNullable<T>[K]
  : NonNullable<T> extends readonly (infer Item)[]
    ? K extends `${number}`
      ? Item
      : unknown
    : unknown

/**
 * 递归解析点号分隔字符串路径，内部使用，公共类型见 PathValueByString。
 */
type StringPathValueInner<T, P extends string> = string extends P
  ? unknown
  : P extends `${infer K}.${infer R}`
    ? StringPathValueInner<StringPathSegmentValue<T, K>, R>
    : StringPathSegmentValue<T, P>

/**
 * 递归解析数组路径，内部使用，公共类型见 PathValueByArray。
 */
type ArrayPathValueInner<T, P extends (string | number)[]> = P extends [
  infer K extends string | number,
  ...infer R extends (string | number)[],
]
  ? K extends keyof NonNullable<T>
    ? R extends []
      ? NonNullable<T>[K]
      : ArrayPathValueInner<NonNullable<T>[K], R>
    : unknown
  : unknown

/**
 * 按点号分隔字符串路径从对象类型中提取值类型。
 *
 * 路径访问在运行时可能得到 `undefined`，例如字段尚未初始化、
 * 中间对象不存在、数组索引不存在等，因此结果始终包含 `undefined`。
 *
 * @typeParam T - 对象类型
 * @typeParam P - 点号分隔字符串路径
 *
 * @example
 * ```ts
 * interface FormData {
 *   user?: { name: string }
 *   tags: string[]
 * }
 *
 * type A = PathValueByString<FormData, "user.name"> // string | undefined
 * type B = PathValueByString<FormData, "tags.0">    // string | undefined
 * ```
 */
export type PathValueByString<T, P extends string> =
  | StringPathValueInner<T, P>
  | undefined

/**
 * 按数组路径从对象类型中提取值类型。
 *
 * 路径访问在运行时可能得到 `undefined`，例如字段尚未初始化、
 * 中间对象不存在、数组索引不存在等，因此结果始终包含 `undefined`。
 *
 * @typeParam T - 对象类型
 * @typeParam P - 数组路径，元素为字符串 key 或数字索引
 *
 * @example
 * ```ts
 * interface FormData {
 *   user?: { name: string }
 *   tags: string[]
 * }
 *
 * type A = PathValueByArray<FormData, ["user", "name"]> // string | undefined
 * type B = PathValueByArray<FormData, ["tags", number]> // string | undefined
 * ```
 */
export type PathValueByArray<T, P extends (string | number)[]> =
  | ArrayPathValueInner<T, P>
  | undefined

/**
 * 按路径从对象类型中提取值类型。
 *
 * 这是统一入口：当路径是点号分隔字符串时分发到 PathValueByString，
 * 当路径是数组时分发到 PathValueByArray。
 *
 * @typeParam T - 对象类型
 * @typeParam P - 路径，可以是 `(string | number)[]` 或点号分隔字符串
 *
 * @example
 * ```ts
 * interface FormData {
 *   user: { name: string; age: number }
 *   tags: string[]
 * }
 *
 * type A = PathValue<FormData, ["user", "name"]> // string | undefined
 * type B = PathValue<FormData, "user.age">       // number | undefined
 * type C = PathValue<FormData, ["tags", number]> // string | undefined
 * ```
 */
export type PathValue<T, P extends (string | number)[] | string> = P extends string
  ? PathValueByString<T, P>
  : P extends (string | number)[]
    ? PathValueByArray<T, P>
    : unknown
