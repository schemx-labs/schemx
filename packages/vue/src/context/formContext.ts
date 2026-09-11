/**
 * 具体表单的 Vue provide/inject 适配。
 *
 * 一个 Form Context 同时保存 Vue Form Instance 与该表单最终用于展示的
 * schemaConfig。ConfigProvider 的组件树级默认配置不属于此 Context。
 *
 * @module context/formContext
 */

import { inject, type InjectionKey, provide } from "vue"

import { useVueFormRuntime, type VueFormRuntime, type VueSchemxInstance } from "../bridge"

import type { SchemxInstance, SchemxSchemaConfig, Values } from "@schemx/core"

// provide/inject 不在运行时固定具体表单值泛型，消费端再恢复 TValues。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErasedFormContextValue = FormContextValue<any>

type LegacyFormContextInstance = VueSchemxInstance<any>

const SCHEMX_FORM_CONTEXT_KEY: InjectionKey<ErasedFormContextValue> = Symbol(
  "schemx:form-context"
)

const LEGACY_FORM_INSTANCE_KEY: InjectionKey<LegacyFormContextInstance> = Symbol(
  "schemx:instance"
)

const LEGACY_FORM_CONFIG_KEY: InjectionKey<FormConfigContextValue> = Symbol(
  "schemx:form-config"
)

/** @internal 仅供迁移期测试注入旧 Context。 */
export const SCHEMX_FORM_INSTANCE_KEY = LEGACY_FORM_INSTANCE_KEY

/** @internal 仅供迁移期测试注入旧 Context。 */
export const SCHEMX_FORM_CONFIG_KEY = LEGACY_FORM_CONFIG_KEY

/**
 * 一个具体 Form 向后代暴露的运行上下文。
 */
export interface FormContextValue<TValues extends Values = Values> {
  /** 当前 Form 的 Vue 响应式实例。 */
  form: VueSchemxInstance<TValues>
  /** 当前 Form 已解析的展示配置。 */
  schemaConfig: Partial<SchemxSchemaConfig>
}

/**
 * 提供完整 Form Context 所需的输入。
 */
export interface ProvideFormContextOptions<TValues extends Values = Values> {
  /** Core Form 或已有 Vue Form Instance。 */
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
  /** 当前 Form 已解析的展示配置。 */
  schemaConfig: Partial<SchemxSchemaConfig>
}

/**
 * 表单展示配置 Context 的兼容值类型。
 */
export interface FormConfigContextValue {
  schemaConfig: Partial<SchemxSchemaConfig>
}

/**
 * 旧名称的兼容类型。
 *
 * @deprecated 请使用 FormConfigContextValue。
 */
export type FormContextProps = FormConfigContextValue

/**
 * 一次性向后代提供具体 Form 的实例与展示配置。
 */
export function provideFormContext<TValues extends Values = Values>(
  options: ProvideFormContextOptions<TValues>
): VueSchemxInstance<TValues> {
  const runtime = useVueFormRuntime(options.form)

  const context: FormContextValue<TValues> = {
    form: runtime.instance,
    get schemaConfig() {
      return options.schemaConfig
    },
  }

  provide<ErasedFormContextValue>(SCHEMX_FORM_CONTEXT_KEY, context as ErasedFormContextValue)

  return runtime.instance
}

/**
 * 获取最近祖先提供的完整 Form Context。
 */
export function useFormContextValue<TValues extends Values = Values>(): FormContextValue<TValues> {
  const context = inject<ErasedFormContextValue | null>(SCHEMX_FORM_CONTEXT_KEY, null)

  if (context) {
    return context as FormContextValue<TValues>
  }

  const form = inject<LegacyFormContextInstance | null>(LEGACY_FORM_INSTANCE_KEY, null)

  const config = inject<FormConfigContextValue | null>(LEGACY_FORM_CONFIG_KEY, null)

  if (form && config) {
    return {
      form: form as VueSchemxInstance<TValues>,
      schemaConfig: config.schemaConfig,
    }
  }

  throw new Error(
    "[schemx] useFormContextValue() must be called inside a <SchemxForm> descendant. " +
      "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
  )
}

/**
 * 向后代提供表单实例的兼容 API。
 *
 * @deprecated 请改用 provideFormContext({ form, schemaConfig })。
 */
export function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueSchemxInstance<TValues> {
  const runtime = useVueFormRuntime(instance)

  provide<LegacyFormContextInstance>(
    LEGACY_FORM_INSTANCE_KEY,
    runtime.instance as LegacyFormContextInstance
  )

  return runtime.instance
}

/**
 * 获取最近祖先提供的 Vue Form Instance。
 *
 * 优先读取统一 Form Context，随后兼容旧的 createFormContext() Provider。
 */
export function useFormContext<TValues extends Values = Values>(): VueSchemxInstance<TValues> {
  const context = inject<ErasedFormContextValue | null>(SCHEMX_FORM_CONTEXT_KEY, null)

  if (context) {
    return context.form as VueSchemxInstance<TValues>
  }

  const instance = inject<LegacyFormContextInstance | null>(LEGACY_FORM_INSTANCE_KEY, null)

  if (!instance) {
    throw new Error(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormContext(form) is called synchronously during setup()."
    )
  }

  return instance as VueSchemxInstance<TValues>
}

/**
 * 向后代提供表单展示配置的兼容 API。
 *
 * @deprecated 请改用 provideFormContext({ form, schemaConfig })。
 */
export function createFormConfigContext(props: FormConfigContextValue): void {
  provide<FormConfigContextValue>(LEGACY_FORM_CONFIG_KEY, props)
}

/**
 * 获取当前 Form 的展示配置。
 *
 * 优先读取统一 Form Context，随后兼容旧的 createFormConfigContext() Provider。
 */
export function useFormConfigContext(): FormConfigContextValue {
  const context = inject<ErasedFormContextValue | null>(SCHEMX_FORM_CONTEXT_KEY, null)

  if (context) {
    return context
  }

  const config = inject<FormConfigContextValue | null>(LEGACY_FORM_CONFIG_KEY, null)

  if (!config) {
    throw new Error(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormConfigContext(props) is called synchronously during setup()."
    )
  }

  return config
}

/**
 * 获取当前表单的内部 Runtime。
 */
export function useFormRuntimeContext<TValues extends Values = Values>(): VueFormRuntime<TValues> {
  return useVueFormRuntime(useFormContext<TValues>())
}
