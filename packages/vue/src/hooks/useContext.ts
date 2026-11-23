/**
 * useContext - 表单上下文 Hook
 *
 * 提供表单上下文的创建与消费能力。
 * schemx 通过 createContext 注入全局配置，
 * 子组件通过 useContext 获取。
 *
 * @module hooks/useContext
 */

import { inject, provide } from "vue"

import type { SchemxFormProps } from "../types"
import type { Values } from "@schemx/core"

/** FormContext 注入 key */
export const FORM_CONTEXT_KEY = Symbol("FormContext")

/**
 * 表单上下文属性
 *
 * 由 schemx 组件注入，包含表单级别的全局配置。
 *
 * @typeParam T - 表单值类型
 */
export interface FormContextProps<T extends Values = Values> extends Omit<
  SchemxFormProps<T>,
  | "form"
  | "modelValue"
  | "rendererRegistry"
  | "defaultRendererType"
  | "rulesRegistery"
  | "onFinish"
  | "onFinishFailed"
  | "onValuesChange"
  | "onFieldsChange"
> {}

/**
 * 创建并注入表单上下文
 *
 * 在 schemx 的 setup 中调用，将表单级别配置注入到子组件树中。
 *
 * @typeParam T - 表单值类型
 * @param props - 表单上下文属性
 */
export const createContext = <T extends Values = Values>(props: FormContextProps<T>) => {
  provide<FormContextProps<T>>(FORM_CONTEXT_KEY, props)
}

/**
 * 获取表单上下文配置
 *
 * 在子组件中获取 schemx 注入的全局配置（readonly、disabled、labelAlign 等）。
 *
 * @returns 表单上下文属性
 *
 * @throws Error 如果不在 schemx 提供的上下文中调用
 *
 * @example
 * ```ts
 * const context = useContext()
 * console.log(context.readonly, context.disabled)
 * ```
 */
export function useContext(): FormContextProps {
  const context = inject<FormContextProps>(FORM_CONTEXT_KEY)

  if (!context) {
    throw new Error("useContext must be used within a Form")
  }

  return context
}
