import { useVueFormRuntime } from "../bridge"

import {
  injectFormContextState,
  provideFormContextState,
  readFormContextInstance,
} from "./index"

import type { FormConfigContextValue } from "./index"
import type { VueFormRuntime } from "../bridge"
import type { SchemxInstance as VueInstance } from "../types"
import type { SchemxInstance, Values } from "@schemx/core"

/**
 * 提供实例的旧入口，保持仅注册实例的行为。
 * @deprecated 请改用 provideFormContext({ form, schemaConfig })。
 * @typeParam TValues - 当前表单值类型。
 * @param instance - 调用方持有的表单实例。
 * @example createFormContext(form)
 */
export function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues>
): VueInstance<TValues> {
  const form = useVueFormRuntime(instance).instance

  provideFormContextState({ form })

  return form
}

/**
 * 提供展示配置的旧入口，保持仅注册配置的行为。
 * @deprecated 请改用 provideFormContext({ form, schemaConfig })。
 * @typeParam TValues - 当前表单值类型。
 * @param props - 当前表单的展示配置来源。
 * @example createFormConfigContext({ schemaConfig: {} })
 */
export function createFormConfigContext<TValues extends Values = Values>(
  props: FormConfigContextValue<TValues>
): void {
  provideFormContextState({ config: props })
}

/**
 * 获取实例的旧入口，不要求同时提供展示配置。
 * @deprecated 请改用 useFormContextValue().form。
 * @typeParam TValues - 当前表单值类型。
 * @example const form = useFormContext()
 */
export function useFormContext<
  TValues extends Values = Values,
>(): SchemxInstance<TValues> {
  return readFormContextInstance<TValues>()
}

/**
 * 获取配置的旧入口，不要求同时提供表单实例。
 * @deprecated 请从 useFormContextValue() 读取展示配置。
 * @typeParam TValues - 当前表单值类型。
 * @example const { schemaConfig } = useFormConfigContext()
 */
export function useFormConfigContext<
  TValues extends Values = Values,
>(): FormConfigContextValue<TValues> {
  const config = injectFormContextState<TValues>()?.config

  if (config === undefined) {
    throw new Error(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  }

  return config
}

/**
 * 获取并为当前 scope 保留 Vue Runtime 的旧入口。
 * @deprecated 请按用途使用 useField、useWatch 或 useViewSchemas。
 * @typeParam TValues - 当前表单值类型。
 * @example const runtime = useFormRuntimeContext()
 */
export function useFormRuntimeContext<
  TValues extends Values = Values,
>(): VueFormRuntime<TValues> {
  return useVueFormRuntime(readFormContextInstance<TValues>())
}
