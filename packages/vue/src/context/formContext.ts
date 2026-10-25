import { getCurrentInstance, inject, provide } from "vue"
import type { ComponentInternalInstance, InjectionKey } from "vue"

import { useVueFormRuntime } from "../bridge"

import type { SchemxButtonComponent } from "../components/Button"
import type {
  SchemxColComponent,
  SchemxIconComponent,
  SchemxRowComponent,
  SchemxInstance as VueInstance,
} from "../types"
import type { SchemxConfig, SchemxInstance, Values } from "@schemx/core"

/**
 * 当前表单的展示默认配置与组件实现 Context。
 *
 * `schemaConfig` 与 {@link SchemxConfig} 的嵌套默认值保持同一类型，
 * 手工提供 Context 时可传局部默认值；SchemxForm 提供 Vue 层合并结果，
 * 不包含 Core 全局和内置默认值的解析结果。
 * 组件实现单独存储，由 Row、Col、Button 和 Icon 渲染入口消费。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface FormConfigContextValue<TValues extends Values = Values> {
  /**
   * 当前表单的 Vue 展示默认值，保留其 `TValues` 和适配层扩展。
   */
  schemaConfig: NonNullable<SchemxConfig<TValues>["schemaConfig"]>
  /** 当前 Form 使用的 Icon Adapter。 */
  iconComponent?: SchemxIconComponent
  /** 当前 Form 使用的 Row 组件。 */
  rowComponent?: SchemxRowComponent
  /** 当前 Form 使用的 Col 组件。 */
  colComponent?: SchemxColComponent
  /**
   * 当前 Form 使用的 Button 组件。
   */
  buttonComponent?: SchemxButtonComponent
}

/**
 * 一个具体 Form 向后代暴露的运行上下文。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface FormContextValue<
  TValues extends Values = Values,
> extends FormConfigContextValue<TValues> {
  /** 当前 Form 的响应式实例。 */
  form: SchemxInstance<TValues>
}

// 旧提供函数允许分别注册实例和配置，因此内部状态可以不完整。
interface FormContextState<TValues extends Values = Values> {
  form?: SchemxInstance<TValues>
  config?: FormConfigContextValue<TValues>
  value?: FormContextValue<TValues>
}

// 新旧入口共享一个注入键和每个组件的提供状态。
const formContextKey: InjectionKey<FormContextState> = Symbol("schemx:form")

const providedContexts = new WeakMap<ComponentInternalInstance, FormContextState>()

/**
 * 读取祖先提供的内部状态，不读取当前组件自身的提供记录。
 * @typeParam TValues - 当前表单值类型。
 * @example const state = injectFormContextState()
 */
export function injectFormContextState<TValues extends Values = Values>():
  FormContextState<TValues> | undefined {
  return inject(formContextKey as InjectionKey<FormContextState<TValues>>, undefined)
}

/**
 * 合并当前组件提供的部分上下文，保留未覆盖的祖先来源。
 * @typeParam TValues - 当前表单值类型。
 * @param context - 本次提供的实例或配置来源。
 * @example provideFormContextState({ form })
 */
export function provideFormContextState<TValues extends Values = Values>(
  context: Pick<FormContextState<TValues>, "form" | "config">
): void {
  const owner = getCurrentInstance()

  let state = owner
    ? (providedContexts.get(owner) as FormContextState<TValues> | undefined)
    : undefined

  if (state === undefined) {
    const parent = injectFormContextState<TValues>()

    state = { form: parent?.form, config: parent?.config }
    if (owner !== null) {
      providedContexts.set(owner, state as FormContextState)
    }
  }

  Object.assign(state, context)

  if (
    state.value === undefined &&
    state.form !== undefined &&
    state.config !== undefined
  ) {
    // 完整视图仅在两项都存在时创建；后续提供只替换来源，不移除任一项。
    const source = state

    const value: FormContextValue<TValues> = {
      get form() {
        return source.form as SchemxInstance<TValues>
      },
      get schemaConfig() {
        return (source.config as FormConfigContextValue<TValues>).schemaConfig
      },
      get iconComponent() {
        return source.config?.iconComponent
      },
      get rowComponent() {
        return source.config?.rowComponent
      },
      get colComponent() {
        return source.config?.colComponent
      },
      get buttonComponent() {
        return source.config?.buttonComponent
      },
    }

    state.value = value
  }

  provide(formContextKey as InjectionKey<FormContextState<TValues>>, state)
}

/**
 * 一次提供 Vue 表单实例与展示配置；不接管外部实例的销毁。
 * @typeParam TValues - 当前表单值类型。
 * @param context - 实例和响应式展示配置来源。
 * @returns Vue Runtime 包装后的实例。
 * @example provideFormContext({ form, schemaConfig: {} })
 */
export function provideFormContext<TValues extends Values = Values>(
  context: FormContextValue<TValues>
): VueInstance<TValues> {
  const form = useVueFormRuntime(context.form).instance

  provideFormContextState({ form, config: context })

  return form
}

/**
 * 获取最近祖先提供的完整表单上下文。
 * @typeParam TValues - 当前表单值类型。
 * @throws 未同时提供实例与配置时抛出错误。
 * @example const { form } = useFormContextValue()
 */
export function useFormContextValue<
  TValues extends Values = Values,
>(): FormContextValue<TValues> {
  const context = useOptionalFormContextValue<TValues>()

  if (context !== undefined) {
    return context
  }

  throw new Error(
    "[schemx] useFormContextValue() must be called inside a <SchemxForm> descendant. " +
      "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
  )
}

/**
 * 供可独立挂载的展示组件读取上下文；不完整或缺失时返回 undefined。
 * @typeParam TValues - 当前表单值类型。
 * @example const context = useOptionalFormContextValue()
 */
export function useOptionalFormContextValue<TValues extends Values = Values>():
  FormContextValue<TValues> | undefined {
  return injectFormContextState<TValues>()?.value
}

/**
 * 读取内部逻辑所需的实例，兼容仅提供实例的旧组件树。
 * @typeParam TValues - 当前表单值类型。
 * @example const form = readFormContextInstance()
 */
export function readFormContextInstance<
  TValues extends Values = Values,
>(): SchemxInstance<TValues> {
  const form = injectFormContextState<TValues>()?.form

  if (form === undefined) {
    throw new Error(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  }

  return form
}
