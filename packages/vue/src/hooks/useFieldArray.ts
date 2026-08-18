/**
 * Vue FieldArray Hook。
 *
 * Hook 从 FormContext 获取运行时表单实例，并将 core FieldArray 控制器投影为
 * Vue 的只读 `fields` shallow ref 和数组操作方法。
 */

import { useFormRuntimeContext } from "./provideFormContext"

import type { UseFieldArrayReturn } from "../types/fieldArray"
import type { FieldArrayPath, Values } from "@schemx/core"

/**
 * 创建一次 Vue FieldArray 返回值。
 *
 * @param name - 动态数组字段路径。
 * @returns 绑定当前 FormContext 的 FieldArray API。
 */
const getFieldArrayHookResult = <
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
>(
  name: TPath
): UseFieldArrayReturn<TValues, TPath> => {
  const runtime = useFormRuntimeContext<TValues>()

  const fieldArrayState = runtime.getFieldArrayState(name)

  const append = fieldArrayState.controller.append

  const appendMany = fieldArrayState.controller.appendMany

  const prepend = fieldArrayState.controller.prepend

  const prependMany = fieldArrayState.controller.prependMany

  const insert = fieldArrayState.controller.insert

  const insertMany = fieldArrayState.controller.insertMany

  const remove = fieldArrayState.controller.remove

  const update = fieldArrayState.controller.update

  const replace = fieldArrayState.controller.replace

  const swap = fieldArrayState.controller.swap

  const move = fieldArrayState.controller.move

  const result: UseFieldArrayReturn<TValues, TPath> = {
    name,
    fields: fieldArrayState.fields,
    append,
    appendMany,
    prepend,
    prependMany,
    insert,
    insertMany,
    remove,
    update,
    replace,
    swap,
    move,
  }

  return result
}

/**
 * 从当前 FormContext 创建指定路径的 FieldArray Hook API。
 *
 * @param name - 动态数组字段路径。
 * @returns 当前路径的响应式 FieldArray API。
 * @typeParam TValues - 表单值类型。
 * @typeParam TPath - 动态数组字段路径类型。
 *
 * @example
 * ```ts
 * const users = useFieldArray<FormValues, "users">("users")
 * users.append({ name: "Alice" })
 * ```
 */
export function useFieldArray<
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
>(name: TPath): UseFieldArrayReturn<TValues, TPath> {
  return getFieldArrayHookResult(name)
}

/**
 * 创建绑定表单值类型的 Vue FieldArray Hook 工厂。
 *
 * 当同一组件树中需要多次调用 Hook 时，工厂可以避免在每次调用处重复提供
 * `TValues`，同时保留路径和行值的精确推导。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 接收动态数组字段路径的 Hook。
 *
 * @example
 * ```ts
 * const useTypedFieldArray = createFieldArrayHook<FormValues>()
 * const users = useTypedFieldArray("users")
 * ```
 */
export function createFieldArrayHook<TValues extends Values>(): <
  TPath extends FieldArrayPath<TValues>,
>(
  name: TPath
) => UseFieldArrayReturn<TValues, TPath> {
  const useTypedFieldArray = <TPath extends FieldArrayPath<TValues>>(
    name: TPath
  ): UseFieldArrayReturn<TValues, TPath> => {
    return getFieldArrayHookResult(name)
  }

  return useTypedFieldArray
}

export type { UseFieldArrayReturn }
