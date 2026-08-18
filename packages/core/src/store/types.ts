/**
 * Store 对外公开的类型定义。
 *
 * @module core/store/types
 */

import type { FieldArrayHandle, FieldArrayItemValue, FieldArrayPath } from "../fieldArray"
import type { FieldValue, NamePath, Values } from "../types"

/**
 * Store 配置选项。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface StoreOptions<TValues extends Partial<Values>> {
  /**
   * 创建 Store 时写入的初始字段值。
   */
  initialValues?: TValues
}

/**
 * Store 状态接口。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface StoreState<TValues extends Values> {
  /**
   * 当前字段值快照。
   */
  values: TValues
  /**
   * 用于重置字段的初始值快照。
   */
  initialValues: TValues
}

/**
 * Pending 字段类型。
 *
 * 正在操作中的字段信息。
 */
export interface StorePending<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 正在执行异步操作的字段路径。
   */
  field: TName
  /**
   * 操作进行期间向用户显示的提示消息。
   */
  message: string[]
}

/**
 * 表单数据存储中心的公开操作接口。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface Store<TValues extends Values = Values> {
  /**
   * 创建指定数组路径的 Handle。
   *
   * @param path - 动态数组字段路径。
   * @typeParam TPath - 动态数组字段路径类型。
   */
  getFieldArrayHandle<TPath extends FieldArrayPath<TValues>>(
    path: TPath
  ): FieldArrayHandle<FieldArrayItemValue<FieldValue<TValues, TPath>>>
  /**
   * 注册 Schema 字段路径，将其作为批量写入的原子值边界。
   *
   * @param path - 要注册的字段路径。
   * @throws 当路径与已注册字段存在父子重叠时抛出错误。
   */
  registerFieldPath<TName extends NamePath<TValues>>(path: TName): void

  /**
   * 批量注册 Schema 字段路径，将每个路径作为批量写入的原子值边界。
   *
   * @param paths - 要注册的字段路径数组。
   * @throws 当任一路径与已注册字段存在父子重叠时抛出错误。
   */
  registerFieldPaths<TName extends NamePath<TValues>>(paths: TName[]): void

  /**
   * 获取指定字段的当前值。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段当前值；字段尚未创建时返回 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 设置指定字段的当前值。
   *
   * @param path - 要写入的字段路径。
   * @param value - 要写入的字段值。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void

  /**
   * 获取多个字段的当前值。
   *
   * @returns 未指定路径时返回全量值，否则返回指定字段的部分值。
   */
  getFieldsValue(): TValues
  /**
   * 获取指定字段的当前值。
   *
   * @param paths - 要读取的字段路径数组。
   * @returns 指定字段组成的部分值。
   */
  getFieldsValue<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>

  /**
   * 批量设置字段的当前值。
   *
   * @param values - 要写入的字段值对象。
   */
  setFieldsValue(values: Partial<TValues>): void

  /**
   * 获取单个字段的无依赖快照。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段当前值的快照。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取当前表单值的无依赖快照。
   *
   * @returns 未指定路径时返回全量快照，否则返回指定字段的部分快照。
   */
  getFieldsSnapshot(): TValues
  /**
   * 获取指定字段的无依赖快照。
   *
   * @param paths - 要读取的字段路径数组。
   * @returns 指定字段组成的部分快照。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>

  /**
   * 获取指定字段的初始值。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段初始值；不存在时返回 `undefined`。
   */
  getInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取表单初始值的副本。
   *
   * @returns 未指定路径时返回全部初始值，否则返回指定字段的部分初始值。
   */
  getInitialValues(): Partial<TValues>
  /**
   * 获取指定字段的初始值副本。
   *
   * @param paths - 要读取的字段路径数组。
   * @returns 指定字段组成的部分初始值。
   */
  getInitialValues<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>

  /**
   * 设置指定字段的初始值。
   *
   * @param path - 要写入的字段路径。
   * @param value - 要写入的初始值。
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName>
  ): void

  /**
   * 批量设置字段的初始值。
   *
   * @param values - 要写入的初始值对象。
   */
  setInitialValues(values: Partial<TValues>): void

  /**
   * 判断指定字段是否被显式触碰或修改。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否处于 touched 状态。
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean

  /**
   * 判断多个字段是否被修改。
   *
   * @returns 不传路径时表示任一字段被修改，传入路径时表示全部字段被修改。
   */
  isFieldsTouched(): boolean
  /**
   * 判断指定字段是否全部被修改。
   *
   * @param paths - 要检查的字段路径数组。
   * @returns 指定字段是否全部处于 touched 状态。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths: TName[]): boolean

  /**
   * 获取所有被显式触碰或修改的字段路径。
   *
   * @returns touched 字段路径数组。
   */
  getTouchedFields(): NamePath<TValues>[]

  /**
   * 设置指定字段的 touched 状态。
   *
   * @param path - 要设置的字段路径。
   * @param touched - 目标 touched 状态。
   */
  setFieldTouched<TName extends NamePath<TValues>>(path: TName, touched: boolean): void

  /**
   * 批量设置字段的 touched 状态。
   *
   * @param paths - 要设置的字段路径数组。
   * @param touched - 目标 touched 状态，默认为 `true`。
   */
  setFieldsTouched<TName extends NamePath<TValues>>(
    paths: TName[],
    touched?: boolean
  ): void

  /**
   * 判断指定字段是否处于 pending 状态。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否正在执行异步操作。
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean

  /**
   * 判断多个字段是否处于 pending 状态。
   *
   * @returns 不传路径时表示任一字段 pending，传入路径时表示全部字段 pending。
   */
  isFieldsPending(): boolean
  /**
   * 判断指定字段是否全部处于 pending 状态。
   *
   * @param paths - 要检查的字段路径数组。
   * @returns 指定字段是否全部处于 pending 状态。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths: TName[]): boolean

  /**
   * 获取所有处于 pending 状态的字段及其提示消息。
   *
   * @returns pending 字段信息数组。
   */
  getPendingFields(): StorePending<TValues, NamePath<TValues>>[]

  /**
   * 设置指定字段的 pending 状态。
   *
   * @param path - 要设置的字段路径。
   * @param pending - 目标 pending 状态。
   * @param message - 可选的 pending 提示消息。
   */
  setFieldPending<TName extends NamePath<TValues>>(
    path: TName,
    pending: boolean,
    message?: string | string[]
  ): void

  /**
   * 批量设置字段的 pending 状态。
   *
   * @param paths - 要设置的字段路径数组。
   * @param pending - 目标 pending 状态，默认为 `true`。
   * @param message - 可选的 pending 提示消息。
   */
  setFieldsPending<TName extends NamePath<TValues>>(
    paths: TName[],
    pending?: boolean,
    message?: string | string[]
  ): void

  /**
   * 将指定字段重置为其初始值。
   *
   * @param path - 要重置的字段路径。
   */
  resetField<TName extends NamePath<TValues>>(path: TName): void

  /**
   * 将指定字段批量重置为其初始值。
   *
   * @param paths - 要重置的字段路径数组。
   */
  resetFields<TName extends NamePath<TValues>>(paths: TName[]): void

  /**
   * 重置表单状态，可选地替换初始值基线。
   *
   * @param values - 可选的新初始值。
   */
  reset(values?: Partial<TValues>): void

  /**
   * 销毁 Store 并释放字段 signal 和 batch 监听。
   */
  destroy(): void
}
