/**
 * useField - 字段控制 Hook。
 *
 * 复用共享 Vue Runtime 的字段 Ref，并将 Core 的字段写入、校验和规则操作
 * 保持在原始 `createField()` 实例上。
 *
 * @module hooks/useField
 */

import { computed } from "vue"

import { createField } from "@schemx/core"

import { useVueFormRuntime } from "../bridge"
import { readFormContextInstance } from "../context"

import type { VueFormRuntime } from "../bridge"
import type { FieldInstance } from "../types"
import type { FieldValue, NamePath, Values } from "@schemx/core"

/**
 * 创建一份字段控制器，并将所有读取状态投影到共享 Vue Field State。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param runtime - 调用方已经绑定到当前 scope 的 Runtime。
 * @param name - 当前字段路径。
 * @returns 同时提供 Core 字段操作和 Vue Ref 状态的字段控制器。
 * @example const field = createFieldHook(runtime, "name")
 */
export function createFieldHook<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(runtime: VueFormRuntime<TValues>, name: TName): FieldInstance<TValues, TName> {
  // 写入继续经过 Core 创建的控制器，保留原有命令和路径取消语义。
  const form = runtime.instance

  const coreField = createField<TValues, TName>(form, name)

  // 读取投影与写入命令绑定同一个控制器，不再缓存初始路径的来源。
  const fieldState = runtime.getBoundFieldState(coreField)

  // 路径是原生字符串，深层只读包装不改变其约束；失效后由 Core 返回 undefined。
  const getName = (): NamePath<TValues> | undefined =>
    fieldState.name.value as NamePath<TValues> | undefined

  // 手动路径来源可以保留最终值，但控制器失效后仍按命令语义返回空值。
  const getValue: FieldInstance<TValues, TName>["getValue"] = () =>
    getName() === undefined ? undefined : fieldState.value.value

  const getErrors: FieldInstance<TValues, TName>["getErrors"] = () =>
    getName() === undefined ? [] : fieldState.errors.value

  const isTouched = (): boolean => getName() !== undefined && fieldState.touched.value

  const isPending = (): boolean => getName() !== undefined && fieldState.pending.value

  // 只组合已桥接的 Ref，不创建另一份 Core 订阅。
  const errors = computed(getErrors)

  const dirty = computed(isTouched)

  const pending = computed(isPending)

  /**
   * Ref 整体赋值保持程序赋值语义，不触发用户交互回调或自动校验。
   * @param nextValue - 当前路径对应的新值或同类型只读值。
   */
  const setValue = (nextValue: FieldInstance<TValues, TName>["value"]["value"]): void => {
    // Core setValue 不修改传入值；只在命令边界恢复同一字段的输入类型。
    coreField.setValue(nextValue as FieldValue<TValues, TName> | undefined)
  }

  // 复用同一来源读取，写入始终提交到当前 Core 绑定。
  const value = computed({ get: getValue, set: setValue })

  const getValues: FieldInstance<TValues, TName>["getValues"] = () =>
    form.getFieldsValue()

  // 先检查命令与投影的完整契约，只有 name 通过 getter 连接当前路径。
  const field: Omit<FieldInstance<TValues, TName>, "name"> = {
    ...coreField,
    value,
    errors,
    dirty,
    pending,
    getValue,
    getErrors,
    isTouched,
    isPending,
    getValues,
  }

  // defineProperty 已建立只读路径属性，此断言仅补齐其类型层面不可见的属性。
  return Object.defineProperty(field, "name", {
    enumerable: true,
    get: getName,
  }) as FieldInstance<TValues, TName>
}

/**
 * 获取单个字段的控制能力。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始字段路径；省略时保留旧的路径联合类型。
 * @param name - 字段路径（支持嵌套字段）。
 * @returns 包含 Vue Ref 状态和 Core 字段操作的控制器。
 *
 * @example
 * ```ts
 * const field = useField("email")
 * field.value.value = "user@example.com"
 * ```
 */
export function useField<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(name: TName): FieldInstance<TValues, TName> {
  const runtime = useVueFormRuntime(readFormContextInstance<TValues>())

  return createFieldHook(runtime, name)
}

export default useField
