/**
 * createField - 框架无关的单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、状态订阅等能力。
 * 框架适配层（Vue / React）可通过 `effect` 桥接各自的响应式系统。
 *
 * @module core/createField
 *
 * @example
 * ```ts
 * import { createField, createForm } from '@schemx/core'
 *
 * const form = createForm({ initialValues: { name: '', avatar: '' } })
 * const field = createField(form, 'name')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.effect(() => {
 *   console.log('value:', field.getValue())
 *   console.log('errors:', field.getErrors())
 * })
 *
 * dispose() // 取消订阅
 * ```
 */

import { setByPath } from "./utils"

import type { FieldValue, NamePath, SchemxInstance, Values } from "./types"
import type { FieldRules } from "./types/rule"
import type { ValidationResult } from "./validator"

/**
 * 单字段控制器接口
 *
 * 封装 SchemxInstance 中与单个字段相关的所有操作，
 * 以及基于 reactive effect 的状态订阅能力。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径类型
 */
export interface SchemxFieldInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 获取当前字段值。
   *
   * @returns 当前字段值；字段不存在时返回 undefined。
   */
  getValue: () => FieldValue<TValues, TName> | undefined

  /**
   * 设置当前字段值。
   *
   * @param value - 新字段值。
   */
  setValue: (value: FieldValue<TValues, TName> | undefined) => void

  /**
   * 获取字段初始值。
   *
   * @returns 当前字段的初始值；未设置时返回 undefined。
   */
  getInitialValue: () => FieldValue<TValues, TName> | undefined

  /**
   * 设置字段初始值。
   *
   * @param value - 新初始值。
   */
  setInitialValue: (value: FieldValue<TValues, TName>) => void

  /**
   * 获取表单当前值。
   *
   * 在 effect 中调用时，读取过程会自动追踪字段变化。
   *
   * @returns 当前表单值对象。
   */
  getValues: () => Readonly<TValues>

  /**
   * 获取表单字段快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshot: () => FieldValue<TValues, TName> | undefined

  /**
   * 获取表单全量快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshots: () => TValues

  /**
   * 校验当前字段。
   *
   * @returns 当前字段校验结果。
   */
  validate: () => Promise<ValidationResult<TValues, TName>>

  /**
   * 获取当前字段错误信息。
   *
   * @returns 错误信息的只读快照；没有错误时返回空数组。
   */
  getErrors: () => readonly string[]

  /**
   * 设置当前字段错误信息。
   *
   * @param errors - 用于替换当前错误状态的消息数组。
   */
  setErrors: (errors: readonly string[]) => void

  /**
   * 清除当前字段错误信息。
   */
  clearErrors: () => void

  /**
   * 替换当前字段的全部校验规则。
   *
   * @param rules - 校验规则或规则数组。
   *
   * @example
   * ```ts
   * field.setRules({
   *   validate: (value) => value
   *     ? { valid: true }
   *     : { valid: false, issues: [{ message: "不能为空" }] },
   * })
   * ```
   */
  setRules: (rules: FieldRules<TValues, TName>) => void

  /**
   * 注销当前字段校验规则。
   */
  removeRules: () => void

  /**
   * 检查当前字段是否已被触摸。
   *
   * @returns 是否已被触摸。
   */
  isTouched: () => boolean

  /**
   * 重置当前字段到初始值。
   */
  reset: () => void

  /**
   * 设置当前字段操作中状态。
   *
   * @param pending - 是否处于操作中。
   * @param message - 可选的操作中提示信息。
   */
  setPending: (pending: boolean, message?: string | string[]) => void

  /**
   * 检查当前字段是否处于操作中。
   *
   * @returns 是否处于操作中。
   */
  isPending: () => boolean

  /**
   * 创建 reactive effect
   *
   * 直接透传 form.effect，在回调中访问 getValue / getErrors / isPending 时
   * 自动追踪对应 reactive 依赖，依赖变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns dispose 函数，取消 effect
   *
   * @example
   * ```ts
   * const dispose = field.effect(() => {
   *   console.log('value:', field.getValue())
   * })
   * dispose()
   * ```
   */
  effect: (fn: () => void) => () => void
}

/**
 * 创建单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 返回包含读写、校验、状态订阅等能力的控制器对象。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径类型
 *
 * @param form - 表单实例
 * @param name - 字段路径
 * @returns 单字段控制器
 *
 * @example
 * ```ts
 * const field = createField(form, 'username')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.effect(() => {
 *   console.log(field.getValue())
 * })
 * ```
 */
export function createField<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(form: SchemxInstance<TValues>, name: TName): SchemxFieldInstance<TValues, TName> {
  /**
   * 从表单实例读取当前字段值。
   */
  const getValue = (): FieldValue<TValues, TName> | undefined => form.getFieldValue(name)

  /**
   * 将当前字段值写回表单实例。
   */
  const setValue = (value: FieldValue<TValues, TName> | undefined): void => {
    form.setFieldValue(name, value)
  }

  /**
   * 读取当前字段的初始值 baseline。
   */
  const getInitialValue = (): FieldValue<TValues, TName> | undefined => {
    return form.getInitialValue(name)
  }

  /**
   * 以字段路径构造局部 initialValues 并交给表单合并。
   */
  const setInitialValue = (value: FieldValue<TValues, TName>): void => {
    const result = {} as Partial<TValues>

    setByPath<TValues, TName, FieldValue<TValues, TName>>(result, name, value)
    form.setInitialValues(result)
  }

  /**
   * 读取表单当前值；调用处在 effect 中时会自动建立字段依赖。
   */
  const getValues = (): Readonly<TValues> => form.getFieldsValue()

  /**
   * 读取 name 当前无追踪快照。
   */
  const getSnapshot = (): FieldValue<TValues, TName> | undefined =>
    form.getFieldSnapshot(name)

  /**
   * 读取表单当前无追踪快照。
   */
  const getSnapshots = (): TValues => form.getFieldsSnapshot()

  /**
   * 触发当前字段校验。
   */
  const validate = (): Promise<ValidationResult<TValues, TName>> => {
    return form.validateField(name)
  }

  /**
   * 读取当前字段错误信息。
   */
  const getErrors = (): readonly string[] => form.getFieldErrors(name)

  /**
   * 写入当前字段错误信息。
   */
  const setErrors = (errors: readonly string[]): void => {
    form.setFieldErrors(name, errors)
  }

  /**
   * 清空当前字段错误信息。
   */
  const clearErrors = (): void => {
    form.clearFieldErrors(name)
  }

  /**
   * 为当前字段注册校验规则。
   */
  const setRules = (rules: FieldRules<TValues, TName>): void => {
    form.setFieldRules(name, rules)
  }

  /**
   * 注销当前字段的校验规则。
   */
  const removeRules = (): void => {
    form.removeFieldRules(name)
  }

  /**
   * 判断当前字段是否被触碰或修改。
   */
  const isTouched = (): boolean => form.isFieldTouched(name) ?? false

  /**
   * 将当前字段重置到初始值。
   */
  const reset = (): void => {
    form.resetFields([name])
  }

  /**
   * 设置当前字段 pending 状态。
   */
  const setPending = (pending: boolean, message?: string | string[]): void => {
    form.setFieldPending(name, pending, message)
  }

  /**
   * 判断当前字段是否处于 pending 状态。
   */
  const isPending = (): boolean => form.isFieldPending(name) ?? false

  /**
   * 创建依赖当前字段读取的响应式副作用。
   */
  const effect = (fn: () => void): (() => void) => {
    return form.effect(fn)
  }

  return {
    getValue,
    setValue,
    getInitialValue,
    setInitialValue,
    getValues,
    getSnapshot,
    getSnapshots,
    validate,
    getErrors,
    setErrors,
    clearErrors,
    setRules,
    removeRules,
    isTouched,
    reset,
    setPending,
    isPending,
    effect,
  }
}
