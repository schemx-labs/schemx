/**
 * 当前字段实例的 Vue provide/inject 适配。
 *
 * @module context/fieldContext
 */

import { inject, type InjectionKey, provide } from "vue"

import type { FieldInstance } from "../types"
import type { NamePath, Values } from "@schemx/core"

// 注入容器擦除业务泛型，字段对象按原样传递。
const SCHEMX_FIELD_CONTEXT_KEY: InjectionKey<object> = Symbol("schemx:field")

/**
 * 向后代组件提供当前路径字段实例。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段允许的路径。
 * @param field - 当前 Vue 字段工具。
 * @example createFieldContext(useField("name"))
 */
export function createFieldContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(field: FieldInstance<TValues, TName>): void {
  provide(SCHEMX_FIELD_CONTEXT_KEY, field)
}

/**
 * 获取最近祖先组件提供的当前字段实例。
 * @example const field = useFieldContext()
 */
export function useFieldContext(): FieldInstance<Values> {
  // 当前注入键只存放 Vue 字段工具。
  const field = inject<object | null>(SCHEMX_FIELD_CONTEXT_KEY, null)

  if (!field) {
    throw new Error(
      "[schemx] useFieldContext() must be called inside a component tree where " +
        "createFieldContext(field) has been called."
    )
  }

  // Context key 只由 createFieldContext 写入，在注入边界恢复擦除的表单类型。
  return field as FieldInstance<Values>
}
