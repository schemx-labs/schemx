/**
 * Store 对外公开的类型定义。
 *
 * Store 将当前值、初始值和路径级交互状态分开管理；字段注册只物化路径状态，
 * 不拥有对应值子树。
 *
 * @module core/store/types
 */

import type {
  FieldArrayChange,
  FieldArrayPath,
  FieldValue,
  NamePath,
  SetValueAction,
  SetValuesAction,
  Values,
} from "../types"
import type { ValidationRuleIssue } from "../validator/types"

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
 * Pending 字段类型。
 *
 * 正在操作中的字段信息。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - pending 字段路径类型。
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
  message: readonly string[]
}

/**
 * Store 中单个字段的错误快照。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface StoreFieldError<TValues extends Values = Values> {
  /**
   * 错误所属的字段路径。
   */
  readonly field: NamePath<TValues>
  /**
   * 按错误来源顺序排列的问题列表。
   */
  readonly errors: readonly ValidationRuleIssue[]
}

/**
 * Runtime 使用的数组结构只读句柄。
 *
 * 句柄只允许注册数组路径、读取行 key 和订阅结构变化，不暴露任何数组写操作。
 */
export interface ArrayStructureHandle {
  /**
   * 注册数组路径并初始化行 key；重复调用幂等。
   */
  register(): void
  /**
   * 读取当前数组行的稳定 key。
   */
  getKeys(): readonly string[]
  /**
   * 订阅结构变化，并返回取消订阅函数。
   */
  subscribe(listener: (change: FieldArrayChange) => void): () => void
}

/**
 * 表单数据存储中心的公开操作接口。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const store = createStore<{ email: string }>({
 *   initialValues: { email: "" },
 * })
 * store.setFieldValue("email", "ada@example.com")
 * ```
 */
export interface Store<TValues extends Values = Values> {
  /**
   * 创建指定数组路径的 Runtime 结构 Handle。
   *
   * @param path - 动态数组字段路径。
   * @typeParam TPath - 动态数组字段路径类型。
   * @returns 只读数组结构 Handle。
   */
  getArrayStructureHandle<TPath extends FieldArrayPath<TValues>>(
    path: TPath
  ): ArrayStructureHandle
  /**
   * 注册 Schema 字段路径并物化对应路径状态。
   *
   * @param path - 要注册的字段路径。
   */
  registerFieldPath<TName extends NamePath<TValues>>(path: TName): void

  /**
   * 反注册 Schema 字段路径；不会删除当前值、初始值或已缓存的路径状态。
   *
   * @param path - 要反注册的字段路径。
   */
  unregisterFieldPath<TName extends NamePath<TValues>>(path: TName): void

  /**
   * 批量注册 Schema 字段路径并物化对应路径状态。
   *
   * @param paths - 要注册的字段路径数组。
   */
  registerFieldPaths<TName extends NamePath<TValues>>(paths: TName[]): void

  /**
   * 设置指定字段的当前值。
   *
   * @param path - 要写入的字段路径。
   * @param action - 要写入的字段值或基于当前值计算下一值的 updater。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    action: SetValueAction<TValues, TName>
  ): void

  /**
   * 删除指定字段的当前值并清理该字段的临时交互状态。
   *
   * @param path - 要删除的字段路径；不会修改初始值。
   */
  removeFieldValue<TName extends NamePath<TValues>>(path: TName): void

  /**
   * 批量设置字段的当前值。
   *
   * @param action - 要写入的字段值对象或基于当前值计算下一值的 updater。
   */
  setFieldsValue(action: SetValuesAction<TValues>): void

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
   * 获取单个字段的无依赖快照。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段当前值的快照。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined

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
   * 获取当前表单值的无依赖快照。
   *
   * @returns 未指定路径时返回全量快照，否则返回指定字段的部分快照。
   */
  getFieldsSnapshot(): TValues
  /**
   * 获取指定字段的无依赖当前值快照。
   *
   * @param paths - 要读取的字段路径数组。
   * @returns 指定字段组成的部分快照。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>

  /**
   * 设置指定字段的初始值。
   *
   * @param path - 要写入的字段路径。
   * @param action - 要写入的初始值或基于当前初始值计算下一值的 updater。
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    action: SetValueAction<TValues, TName>
  ): void

  /**
   * 批量设置字段的初始值。
   *
   * @param action - 要写入的初始值对象或基于当前初始值计算下一值的 updater。
   */
  setInitialValues(action: SetValuesAction<TValues>): void

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
   * 判断指定字段是否被显式触碰或修改。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否处于 touched 状态。
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean

  /**
   * 判断是否存在已注册但尚未 touched 的字段。
   *
   * @returns 存在尚未 touched 的字段时返回 `true`。
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
   * 判断指定字段是否处于 pending 状态。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否正在执行异步操作。
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean

  /**
   * 判断是否存在已注册但尚未 pending 的字段。
   *
   * @returns 存在尚未 pending 的字段时返回 `true`。
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
   * 覆盖指定字段的全部错误来源。
   *
   * @param path - 要写入的字段路径。
   * @param errors - 要保存的问题列表。
   */
  setFieldErrors(path: NamePath<TValues>, errors: readonly ValidationRuleIssue[]): void

  /**
   * 批量设置多个字段的全部错误来源。
   *
   * @param fields - 字段路径及其对应的问题列表。
   */
  setFieldsErrors(fields: readonly StoreFieldError<TValues>[]): void

  /**
   * 读取指定字段按错误来源顺序合并的问题。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段错误问题的独立快照。
   */
  getFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[]

  /**
   * 读取多个字段的错误问题；省略路径时返回全部有错误的字段。
   *
   * @param paths - 可选的字段路径数组；传入后按路径顺序返回，空错误也会保留。
   * @returns 字段错误问题的独立快照。
   */
  getFieldsErrors(paths?: readonly NamePath<TValues>[]): StoreFieldError<TValues>[]

  /**
   * 无依赖读取指定字段的问题。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段错误问题的独立快照。
   */
  peekFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[]

  /**
   * 无依赖读取多个字段的错误问题；省略路径时返回全部有错误的字段。
   *
   * @param paths - 可选的字段路径数组；传入后按路径顺序返回，空错误也会保留。
   * @returns 字段错误问题的独立快照。
   */
  peekFieldsErrors(paths?: readonly NamePath<TValues>[]): StoreFieldError<TValues>[]

  /**
   * 清除指定字段的全部错误来源。
   *
   * @param path - 要清除的字段路径。
   */
  clearFieldErrors(path: NamePath<TValues>): void

  /**
   * 清除多个字段的全部错误来源；省略路径时清除全部字段。
   *
   * @param paths - 可选的字段路径数组。
   */
  clearFieldsErrors(paths?: readonly NamePath<TValues>[]): void

  /**
   * 清除所有已注册字段的错误来源。
   */
  clearAllErrors(): void

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
   * @param values - 可选的新完整初始值；传入后不存在的旧路径会被移除。
   */
  reset(values?: Partial<TValues>): void

  /**
   * 按数组结构变更范围清理过期错误。
   *
   * @param path - 发生结构变更的数组根路径。
   * @param change - 用于判断受影响索引范围的变更描述。
   */
  invalidateFieldArrayErrors(path: NamePath<TValues>, change: FieldArrayChange): void

  /**
   * 销毁 Store，清空值和路径状态，并释放数组结构监听。
   */
  destroy(): void
}
