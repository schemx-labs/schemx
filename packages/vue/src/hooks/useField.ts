/**
 * 按消费端提供的当前路径组合字段命令和 Vue 状态。
 * @module hooks/useField
 */

import { computed, unref } from "vue"

import { useVueFormRuntime } from "../bridge"
import { readFormContextInstance } from "../context"

import type { VueFormRuntime } from "../bridge"
import type { FieldInstance, FieldPathSource } from "../types"
import type { DeepReadonly, FieldValue, NamePath, Values } from "@schemx/core"

/**
 * 组合路径字段工具；每次调用读取当前路径，不保存运行时节点身份。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 路径来源允许的字段路径。
 * @param runtime - 调用方已经保留的共享 Vue Runtime。
 * @param name - 固定路径、路径 Ref 或获取当前路径的函数。
 * @returns 复用 Runtime 订阅的 Vue 状态和路径命令。
 * @example const field = createFieldHook(runtime, () => props.name)
 */
export function createFieldHook<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  runtime: VueFormRuntime<TValues>,
  name: FieldPathSource<TName>
): FieldInstance<TValues, TName> {
  // Instance 已桥接路径读取，按需复用共享状态订阅。
  const form = runtime.instance

  // 消费端拥有路径来源，Schema 改名不隐式改变固定路径。
  const getName = (): TName => (typeof name === "function" ? name() : unref(name))

  /**
   * 读取当前路径的值，通过 Instance 建立 Vue 与 Core 依赖。
   * @example const value = field.getValue()
   */
  const getValue: FieldInstance<TValues, TName>["getValue"] = () =>
    form.getFieldValue(getName()) as DeepReadonly<FieldValue<TValues, TName>> | undefined

  /**
   * 程序赋值不触发用户交互；updater 支持函数值。
   * @param next - 当前路径的新字段值。
   * @example field.setValue("Ada")
   */
  const setValue: FieldInstance<TValues, TName>["setValue"] = (next) => {
    form.setFieldValue(getName(), () => next)
  }

  /**
   * Vue 只读对象整体赋值时恢复 Core 的字段值类型。
   * @param next - 从 value Ref 赋入的新值。
   */
  const writeValue = (next: FieldInstance<TValues, TName>["value"]["value"]): void => {
    setValue(next as FieldValue<TValues, TName> | undefined)
  }

  /**
   * 读取当前路径的初始值。
   * @example const value = field.getInitialValue()
   */
  const getInitialValue = (): FieldValue<TValues, TName> | undefined =>
    form.getInitialValue(getName())

  /**
   * 更新当前路径的重置基线。
   * @param next - 新的初始值。
   * @example field.setInitialValue("Ada")
   */
  const setInitialValue = (next: FieldValue<TValues, TName>): void => {
    form.setInitialValue(getName(), () => next)
  }

  /**
   * 读取整表响应式值。
   * @example const values = field.getValues()
   */
  const getValues = (): TValues => form.getFieldsValue()

  /**
   * 读取调用时路径的快照，不追踪字段值变化。
   * @example const value = field.getSnapshot()
   */
  const getSnapshot = (): FieldValue<TValues, TName> | undefined =>
    form.getFieldSnapshot(getName())

  /**
   * 读取整表无依赖快照。
   * @example const values = field.getSnapshots()
   */
  const getSnapshots = (): TValues => form.getFieldsSnapshot()

  /**
   * 读取当前路径的错误消息。
   * @example const errors = field.getErrors()
   */
  const getErrors = (): readonly string[] => form.getFieldErrors(getName())

  /**
   * 替换当前路径的外部错误。
   * @param messages - 新的错误消息列表。
   * @example field.setErrors(["不能为空"])
   */
  const setErrors = (messages: readonly string[]): void =>
    form.setFieldErrors(getName(), messages)

  /**
   * 清除当前路径的错误。
   * @example field.clearErrors()
   */
  const clearErrors = (): void => form.clearFieldErrors(getName())

  /**
   * 设置当前路径的手动校验规则。
   * @param rules - 覆盖原声明的字段规则。
   * @example field.setRules({ required: true })
   */
  const setRules: FieldInstance<TValues, TName>["setRules"] = (rules) =>
    form.setFieldRules(getName(), rules)

  /**
   * 移除当前路径的手动规则覆盖。
   * @example field.removeRules()
   */
  const removeRules = (): void => form.removeFieldRules(getName())

  /**
   * 标记当前路径的交互状态。
   * @param touched - 是否已触碰。
   * @example field.setTouched(true)
   */
  const setTouched = (touched: boolean): void => form.setFieldTouched(getName(), touched)

  /**
   * 读取当前路径的触碰状态。
   * @example const touched = field.isTouched()
   */
  const isTouched = (): boolean => form.isFieldTouched(getName())

  /**
   * 设置当前路径的 pending 状态。
   * @param pending - 是否正在操作。
   * @param message - 操作期间的提示。
   * @example field.setPending(true, "上传中")
   */
  const setPending = (pending: boolean, message?: string | string[]): void =>
    form.setFieldPending(getName(), pending, message)

  /**
   * 读取当前路径的 pending 状态。
   * @example const pending = field.isPending()
   */
  const isPending = (): boolean => form.isFieldPending(getName())

  /**
   * 重置当前路径。
   * @example field.reset()
   */
  const reset = (): void => form.resetField(getName())

  /**
   * 校验调用时的路径，由 Core 管理该次校验的取消。
   * @example await field.validate()
   */
  const validate: FieldInstance<TValues, TName>["validate"] = () =>
    form.validateField(getName())

  /**
   * 向当前路径提交用户修改。
   * @param next - 用户提交的字段值。
   * @example await field.change("Ada")
   */
  const change: FieldInstance<TValues, TName>["change"] = (next) =>
    form.changeField(getName(), next)

  /**
   * 向当前路径提交失焦。
   * @example await field.blur()
   */
  const blur: FieldInstance<TValues, TName>["blur"] = () => form.blurField(getName())

  // Core effect 生命周期继续归 Form 所有。
  const effect = form.effect

  // Vue computed 跟踪路径来源及共享的字段状态，不增加 Core 订阅。
  const value = computed({ get: getValue, set: writeValue })

  const errors = computed(getErrors)

  const dirty = computed(isTouched)

  const pending = computed(isPending)

  // 只读 name getter 每次解析消费端路径，其余方法保持稳定引用。
  return Object.defineProperty(
    {
      change,
      blur,
      setValue,
      getInitialValue,
      setInitialValue,
      getValues,
      getSnapshot,
      getSnapshots,
      getErrors,
      setErrors,
      clearErrors,
      setRules,
      removeRules,
      setTouched,
      isTouched,
      setPending,
      isPending,
      reset,
      validate,
      effect,
      value,
      errors,
      dirty,
      pending,
      getValue,
    },
    "name",
    { enumerable: true, get: getName }
  ) as FieldInstance<TValues, TName>
}

/**
 * 从当前 Form 上下文获取路径字段工具。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 路径来源允许的字段路径。
 * @param name - 固定路径、路径 Ref 或当前路径 getter。
 * @returns Vue 状态与当前路径的操作方法。
 * @example const field = useField(() => props.name)
 */
export function useField<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(name: FieldPathSource<TName>): FieldInstance<TValues, TName> {
  // 当前 Vue scope 保留共享 Runtime，卸载后自动释放。
  const runtime = useVueFormRuntime(readFormContextInstance<TValues>())

  return createFieldHook(runtime, name)
}

export default useField
