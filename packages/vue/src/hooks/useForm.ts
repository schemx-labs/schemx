/**
 * useForm - Schemx 表单实例的 Vue 生命周期适配。
 *
 * 负责创建由当前 Vue effect scope 持有的 SchemxInstance，并在 scope 销毁时
 * 自动释放实例。该模块不负责 provide/inject；表单上下文统一由
 * provideFormContext() 注册，避免外部传入 form 时跳过上下文注册。
 *
 * @module hooks/useForm
 */
import { onScopeDispose } from "vue"

import { createForm, mergeConfig } from "@schemx/core"

import { useVueFormRuntime } from "../bridge"
import { defaultConfig } from "../config/defaultConfig"
import { useConfigProviderContextRef } from "../context/configProviderContext"

import type {
  CreateFormOptions,
  CreateSchemxOptions,
  SchemxApi,
  SchemxInstance,
  Values,
} from "@schemx/core"

/**
 * Vue 表单创建选项，支持嵌套 Schema 默认值及 Core 实例级配置。
 *
 * @typeParam TValues - 表单值类型。
 */
export type UseFormOptions<TValues extends Values = Values> = CreateFormOptions<TValues>

/**
 * 创建由当前 Vue effect scope 持有的表单实例。
 *
 * useForm 只负责以下职责：
 * 1. 合并表单显式、组件树 Provider、App 安装和 Vue 层默认配置；
 * 2. 将配置通过单个参数交给 Core，同步创建 SchemxInstance；
 * 3. 在当前 effect scope 销毁时调用 instance.destroy()。
 *
 * useForm 不再自动调用 provide()。需要向后代组件暴露实例时，应由
 * <SchemxForm> 或其他 Provider 组件显式调用 provideFormContext({ form, schemaConfig })。
 * 这样无论实例是内部创建还是通过 props.form 外部传入，都能走同一条
 * 上下文注册路径，并保持清晰的实例所有权：谁创建，谁销毁。
 *
 * 该函数应在组件 setup() 或其他有效的 Vue effect scope 中同步调用。
 * 非 Vue 生命周期场景请直接使用 @schemx/core 的 createForm()，并自行销毁实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 表单创建配置
 * @param creator - 可选的同步创建器；提供时不预填 Vue 默认值。
 * @returns 当前 scope 持有的 SchemxInstance
 *
 * @example
 * ```ts
 * const form = useForm({
 *   initialValues: {
 *     name: "",
 *     email: "",
 *   },
 *   onFinish: async (values) => {
 *     await api.submit(values)
 *   },
 * })
 *
 * form.setFieldValue("name", "Schemx")
 * ```
 *
 * @example
 * ```ts
 * // Provider 组件中统一注册上下文。
 * const form = props.form ?? useForm(options)
 * provideFormContext({ form, schemaConfig: {} })
 * ```
 */
export function useForm<TValues extends Values = Values>(
  options: UseFormOptions<TValues> = {},
  creator?: SchemxApi["createForm"]
): SchemxInstance<TValues> {
  // 创建器负责继承默认值；Vue 只将局部上下文作为本次选项传入。
  const configuredOptions = mergeConfig<TValues>(
    options,
    (useConfigProviderContextRef()?.value as CreateSchemxOptions<TValues> | undefined) ??
      {},
    ...(creator === undefined ? [{ schemaConfig: defaultConfig }] : [])
  )

  // 合并结果与实例选项统一通过第一个参数下传。
  const instance = (creator ?? createForm)<TValues>({ ...options, ...configuredOptions })

  const form = useVueFormRuntime(instance).instance

  // useForm 创建的实例归当前 effect scope 所有，因此由当前 scope 负责销毁。
  onScopeDispose(() => {
    form.destroy()
  })

  return form
}
