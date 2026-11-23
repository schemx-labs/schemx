/**
 * 字典选项类型定义
 *
 * 定义字典选项的配置接口，支持通过 api 函数获取数据，
 * 完整的表单值泛型推导，以及依赖字段联动。
 *
 * @module types/dictionary
 */

import { NamePath, SchemxInstance, Values } from "./form"

/**
 * 字典选项配置
 *
 * 通过 api 函数获取数据，支持完整泛型推导。
 * api 的返回值类型 R 会自动传递给 formatter 和 onSuccess。
 *
 * @typeParam T - 表单值类型
 * @typeParam R - api 函数的返回值类型
 *
 * @example
 * ```ts
 * // 基础用法
 * dict: {
 *   api: async () => fetchOptions(),
 * }
 *
 * // 带依赖联动 — values 自动推导为表单类型
 * dict: {
 *   api: async (values) => fetchCities(values.province),
 *   dependsOn: ['province'],
 *   shouldFetch: (values) => !!values.province,
 *   resetOnDepsChange: true,
 *   immediate: false,
 * }
 *
 * // formatter 的 res 自动推导为 api 返回值类型
 * dict: {
 *   api: async (values) => fetchCities(values.province),
 *   //    ^ 返回 CityResponse[]
 *   formatter: (res) => res.map(c => ({ label: c.name, value: c.id })),
 *   //          ^ res: CityResponse[]
 * }
 * ```
 */
export interface SchemxDictionary<T extends Values = Values, R = any> {
  /**
   * 数据获取函数
   *
   * 接收当前表单值和表单实例，返回数据（支持异步）。
   * 返回值类型 R 会自动传递给 formatter 的第一个参数。
   *
   * @param values - 当前表单值。
   * @param form - 当前表单实例。
   * @returns 原始字典数据，支持同步或异步返回。
   *
   * @example
   * ```ts
   * dict: {
   *   api: async (values, form) => {
   *     const res = await myApi.getCities(values.province)
   *     return res.data
   *   },
   *   dependsOn: ['province'],
   *   shouldFetch: (values) => !!values.province,
   * }
   * ```
   */
  api: (values: T, form: SchemxInstance<T>) => R | Promise<R>

  /**
   * 响应数据格式化函数
   *
   * 第一个参数 res 的类型自动从 api 的返回值推导。
   *
   * @param res - api 返回并 await 后的结果。
   * @param form - 当前表单实例。
   * @returns 标准化后的选项数组，支持同步或异步返回。
   */
  formatter?: (res: Awaited<R>, form: SchemxInstance<T>) => any[] | Promise<any[]>

  /**
   * 依赖的表单字段路径
   *
   * 当这些字段的值变化时，自动重新执行 api 函数。
   * 不配置则仅在 onMounted 时执行一次。
   */
  dependsOn?: NamePath<T>[]

  /**
   * 是否应该执行 api
   *
   * 依赖字段变化时先调用此函数，返回 false 则跳过执行并清空 options。
   * 典型场景：省份为空时不请求城市列表。
   *
   * 不配置时默认始终执行。
   *
   * @param values - 当前表单值。
   * @returns 是否执行 api。
   */
  shouldFetch?: (values: T) => boolean

  /**
   * 是否在组件挂载时立即执行
   *
   * - true（默认）：onMounted 时执行 api
   * - false：挂载时不执行，等待 dependsOn 字段变化或手动 refresh
   */
  immediate?: boolean

  /**
   * 依赖字段变化时是否清空当前字段的值
   *
   * - true：依赖变化时调用 form.setFieldValue(fieldName, undefined)
   * - false（默认）：不清空，仅重新执行 api
   *
   * 需要配合 useDictionary 的 fieldName 参数使用。
   */
  resetOnDepsChange?: boolean

  /** 失败重试次数，默认 `0`（不重试） */
  retryCount?: number
  /** 重试间隔（毫秒），默认 `1000` */
  retryInterval?: number

  /** 请求失败回调 */
  onError?: (error: Error, form: SchemxInstance<T>) => void

  /**
   * 请求成功回调
   *
   * 在 formatter 之后、写入 list 之后调用。
   */
  onSuccess?: (data: any[], form: SchemxInstance<T>) => void

  /**
   * 依赖字段变化回调
   *
   * 在 shouldFetch 判断之前调用，无论是否执行 api 都会触发。
   * 可用于依赖变化时的额外清理逻辑（如清空下级字段）。
   */
  onDepsChange?: (values: T, form: SchemxInstance<T>) => void
}

/**
 * 为 Props 类型注入可选的 dict 字段
 *
 * 将任意组件 Props 类型 A 扩展为包含 `dict?: SchemxDictionary<T>` 的新类型。
 * 用于为渲染器组件的 Props 添加字典选项支持。
 *
 * @typeParam A - 原始组件 Props 类型
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * interface MySelectProps {
 *   options?: { label: string; value: string }[]
 *   placeholder?: string
 * }
 *
 * // 扩展后的类型包含 dict 字段
 * type MySelectWithDict = SchemxWithDictionary<MySelectProps, MyFormValues>
 * // 等价于 MySelectProps & { dict?: SchemxDictionary<MyFormValues> }
 * ```
 */
export type SchemxWithDictionary<A, T extends Values = Values> = A & {
  dict?: SchemxDictionary<T>
}
