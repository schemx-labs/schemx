/**
 * createField - 基于 Form instance 的轻量字段工具
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、状态订阅等能力。
 * 框架适配层只需桥接传入的 Form instance。
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

import { runSignalUntracked } from "./reactivity"
import { createValidationCancelled } from "./validator"

import type {
  FieldRef,
  FieldRefState,
  FieldValue,
  NamePath,
  SchemxInstance,
  Values,
} from "./types"
import type { FieldRules } from "./types/rule"
import type { ValidationResult } from "./validator"

/**
 * 兼容字段工具接口
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
   * 字段引用，所有操作都经由 Form instance。
   */
  readonly ref: FieldRef<TValues, TName>
  /**
   * 兼容只读状态，状态实际由 Form 持有。
   */
  readonly state: FieldRefState<TValues, TName>
  /**
   * 用户修改直接委托 Form 的交互入口。
   */
  change(
    value: FieldValue<TValues, TName> | undefined
  ): Promise<ValidationResult<TValues> | undefined>
  /**
   * 用户失焦直接委托 Form。
   */
  blur(): Promise<ValidationResult<TValues> | undefined>
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
  getValues: () => TValues

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
   * 设置字段交互状态。
   *
   * 传入路径设置字段修改状态。
   */
  setTouched(value: boolean): void

  /**
   * 检查当前字段是否已被触摸。
   *
   * @returns 是否已被触摸。
   */
  isTouched: () => boolean

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
   * 重置当前字段到初始值。
   */
  reset: () => void

  /**
   * 校验当前字段。
   *
   * @returns 当前字段校验结果。
   */
  validate: () => Promise<ValidationResult<TValues, TName>>

  /**
   * 创建 reactive effect
   *
   * 直接透传 form.effect，并绑定字段引用的生命周期，在回调中访问 getValue / getErrors / isPending 时
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
 * 创建兼容字段工具。
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
  const ref = form.getFieldRef(name)

  const state = form.getFieldState(ref)

  // 读取经过传入实例的桥接；命令和快照只读取原生路径快照。
  const getName = (): TName | undefined => form.getFieldName(ref) as TName | undefined

  const readName = (): TName | undefined => state.name.peek() as TName | undefined

  const change = (
    value: FieldValue<TValues, TName> | undefined
  ): Promise<ValidationResult<TValues> | undefined> => {
    const current = readName()

    return current === undefined
      ? Promise.resolve(undefined)
      : form.changeField(current, value)
  }

  const blur = (): Promise<ValidationResult<TValues> | undefined> => {
    const current = readName()

    return current === undefined ? Promise.resolve(undefined) : form.blurField(current)
  }

  const getValue = (): FieldValue<TValues, TName> | undefined => {
    const current = getName()

    return current === undefined ? undefined : form.getFieldValue(current)
  }

  const getInitialValue = (): FieldValue<TValues, TName> | undefined => {
    const current = getName()

    return current === undefined ? undefined : form.getInitialValue(current)
  }

  const getErrors = (): readonly string[] => {
    const current = getName()

    return current === undefined ? [] : form.getFieldErrors(current)
  }

  const isTouched = (): boolean => {
    const current = getName()

    return current !== undefined && form.isFieldTouched(current)
  }

  const isPending = (): boolean => {
    const current = getName()

    return current !== undefined && form.isFieldPending(current)
  }

  const setValue = (value: FieldValue<TValues, TName> | undefined): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setFieldValue(current, () => value)
    })

  const setInitialValue = (value: FieldValue<TValues, TName>): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setInitialValue(current, () => value)
    })

  const setErrors = (errors: readonly string[]): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setFieldErrors(current, errors)
    })

  const clearErrors = (): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.clearFieldErrors(current)
    })

  const setTouched = (value: boolean): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setFieldTouched(current, value)
    })

  const setPending = (pending: boolean, message?: string | string[]): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setFieldPending(current, pending, message)
    })

  const reset = (): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.resetField(current)
    })

  // 规则按调用时的路径转发，暂不维护节点规则的迁移。
  const setRules = (rules: FieldRules<TValues, TName>): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.setFieldRules(current, rules)
    })

  const removeRules = (): void =>
    runSignalUntracked(() => {
      const current = readName()

      if (current !== undefined) form.removeFieldRules(current)
    })

  const getSnapshot = (): FieldValue<TValues, TName> | undefined => {
    const current = readName()

    return current === undefined ? undefined : form.getFieldSnapshot(current)
  }

  const getValues = (): TValues => form.getFieldsValue()

  const getSnapshots = (): TValues => form.getFieldsSnapshot()

  const validate = (): Promise<ValidationResult<TValues, TName>> => {
    const current = readName()

    return current === undefined
      ? Promise.resolve(createValidationCancelled(form.getFieldsSnapshot()))
      : form.validateField(current)
  }

  // 仅绑定本次订阅，引用失效时取消，不创建另一套字段响应式状态。
  const effect = (fn: () => void): (() => void) => {
    let stop = (): void => {}

    const cancel = form.effect(() => {
      if (getName() === undefined) stop()
      else fn()
    })

    stop = cancel
    if (readName() === undefined) cancel()

    return cancel
  }

  return {
    ref,
    state,
    change,
    blur,
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
    setTouched,
    isTouched,
    reset,
    setPending,
    isPending,
    effect,
  }
}

/**
 * @deprecated 使用 FieldRefState；状态由 Form 持有。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始字段路径。
 */
export type SchemxFieldState<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = FieldRefState<TValues, TName>
