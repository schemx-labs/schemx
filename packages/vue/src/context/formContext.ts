/**
 * 具体表单的 Vue provide/inject 适配。
 *
 * 一个 Form Context 同时保存 SchemxInstance 与该表单最终用于展示的
 * schemaConfig；其中包含从 ConfigProvider/App 继承的值，不保留 Provider 原始配置对象。
 *
 * @module context/formContext
 */

import { inject, type InjectionKey, provide } from "vue"

import { useVueFormRuntime, type VueFormRuntime } from "../bridge"

import type { SchemxIconComponent } from "../types/icon"
import type { SchemxColComponent, SchemxRowComponent } from "../types/layout"
import type { SchemxInstance, SchemxSchemaConfig, Values } from "@schemx/core"

/**
 * 表单实例的注入键。
 *
 * @internal
 */
export const SCHEMX_FORM_INSTANCE_KEY: InjectionKey<SchemxInstance> =
  Symbol("schemx:instance")

/**
 * 表单展示配置的注入键。
 *
 * @internal
 */
export const SCHEMX_FORM_CONFIG_KEY: InjectionKey<FormConfigContextValue> =
  Symbol("schemx:form-config")

/**
 * 表单展示配置 Context。
 */
export interface FormConfigContextValue {
  /** 当前 Form 已解析的展示配置。 */
  schemaConfig: Partial<SchemxSchemaConfig>
  /** 当前 Form 使用的 Icon Adapter。 */
  iconComponent?: SchemxIconComponent
  /** 当前 Form 使用的 Row 组件。 */
  rowComponent?: SchemxRowComponent
  /** 当前 Form 使用的 Col 组件。 */
  colComponent?: SchemxColComponent
}

/**
 * 一个具体 Form 向后代暴露的运行上下文。
 */
export interface FormContextValue<
  TValues extends Values = Values,
> extends FormConfigContextValue {
  /** 当前 Form 的响应式实例。 */
  form: SchemxInstance<TValues>
}

/**
 * 一次性向后代提供具体 Form 的实例与最终展示配置。
 *
 * @typeParam TValues - 表单值类型。
 * @param context - Form 实例、展示配置和可选的布局组件与 Icon Adapter。
 * @returns Vue Runtime 包装后的 Form 实例。
 *
 * @example
 * ```ts
 * setup() {
 *   const form = useForm({ initialValues: { name: "" } })
 *   provideFormContext({ form, schemaConfig: {} })
 * }
 * ```
 */
export function provideFormContext<TValues extends Values = Values>(
  context: FormContextValue<TValues>
): SchemxInstance<TValues> {
  const form = useVueFormRuntime<TValues>(context.form).instance

  provide(SCHEMX_FORM_INSTANCE_KEY, form as SchemxInstance)
  provide(SCHEMX_FORM_CONFIG_KEY, context)

  return form
}

/**
 * 获取最近祖先提供的完整 Form Context。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 最近的 Form 实例和最终展示配置。
 * @throws 当前组件树中没有 Form Context 时抛出错误。
 *
 * @example
 * ```ts
 * setup() {
 *   const context = useFormContextValue()
 *   context.form.submit()
 * }
 * ```
 */
export function useFormContextValue<
  TValues extends Values = Values,
>(): FormContextValue<TValues> {
  const context = useOptionalFormContextValue<TValues>()

  if (context) {
    return context
  }

  throw new Error(
    "[schemx] useFormContextValue() must be called inside a <SchemxForm> descendant. " +
      "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
  )
}

/**
 * 尝试读取当前 Form Context。
 *
 * 供可直接挂载的 Group、Dynamic 等底层组件在存在 Form 上下文时消费展示配置；
 * 脱离 Form 时返回 `undefined`，由组件自身的兼容 Props 提供回退。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 最近的 Form Context；未在 Form 后代中调用时返回 `undefined`。
 *
 * @example
 * ```ts
 * setup() {
 *   const context = useOptionalFormContextValue()
 *   return { rowComponent: context?.rowComponent }
 * }
 * ```
 */
export function useOptionalFormContextValue<TValues extends Values = Values>():
  FormContextValue<TValues> | undefined {
  const form = inject(SCHEMX_FORM_INSTANCE_KEY, null)

  const config = inject(SCHEMX_FORM_CONFIG_KEY, null)

  if (form && config) {
    return {
      form: form as SchemxInstance<TValues>,
      get schemaConfig() {
        return config.schemaConfig
      },
      get iconComponent() {
        return config.iconComponent
      },
      get rowComponent() {
        return config.rowComponent
      },
      get colComponent() {
        return config.colComponent
      },
    }
  }

  return undefined
}

/**
 * 向后代提供表单实例的兼容 API。
 *
 * @deprecated 请改用 {@link provideFormContext}({ form, schemaConfig })。
 *
 * @param instance - 要提供给后代组件的 SchemxInstance。
 * @returns Vue Runtime 包装后的 Form 实例。
 *
 * @example
 * ```ts
 * setup() {
 *   const form = useForm()
 *   provideFormContext({ form, schemaConfig: {} })
 * }
 * ```
 */
export function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues>
): SchemxInstance<TValues> {
  const form = useVueFormRuntime<TValues>(instance).instance

  provide(SCHEMX_FORM_INSTANCE_KEY, form as SchemxInstance)

  return form
}

/**
 * 获取最近祖先提供的表单实例。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 最近的 SchemxInstance。
 * @throws 当前组件树中没有 Form 实例时抛出错误。
 *
 * @example
 * ```ts
 * setup() {
 *   const form = useFormContext()
 *   form.getFieldsValue()
 * }
 * ```
 */
export function useFormContext<
  TValues extends Values = Values,
>(): SchemxInstance<TValues> {
  const instance = inject(SCHEMX_FORM_INSTANCE_KEY, null)

  if (!instance) {
    throw new Error(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  }

  return instance as SchemxInstance<TValues>
}

/**
 * 向后代提供表单展示配置的兼容 API。
 *
 * @deprecated 请改用 {@link provideFormContext}({ form, schemaConfig })。
 *
 * @param props - 要提供给后代的 Form 展示配置。
 *
 * @example
 * ```ts
 * setup() {
 *   const form = useForm()
 *   provideFormContext({ form, ...props })
 * }
 * ```
 */
export function createFormConfigContext(props: FormConfigContextValue): void {
  provide(SCHEMX_FORM_CONFIG_KEY, props)
}

/**
 * 获取当前 Form 的展示配置。
 *
 * @returns 最近 Form 提供的最终展示配置。
 * @throws 当前组件树中没有 Form Config Context 时抛出错误。
 *
 * @example
 * ```ts
 * setup() {
 *   const { schemaConfig } = useFormConfigContext()
 *   console.log(schemaConfig.readonly)
 * }
 * ```
 */
export function useFormConfigContext(): FormConfigContextValue {
  const config = inject(SCHEMX_FORM_CONFIG_KEY, null)

  if (!config) {
    throw new Error(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  }

  return config
}

/**
 * 获取当前表单的 Vue Runtime。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 当前 Form 对应的 Vue Runtime。
 *
 * @example
 * ```ts
 * setup() {
 *   const runtime = useFormRuntimeContext()
 *   return { values: runtime.instance.getFieldsValue() }
 * }
 * ```
 */
export function useFormRuntimeContext<
  TValues extends Values = Values,
>(): VueFormRuntime<TValues> {
  return useVueFormRuntime(useFormContext<TValues>())
}
