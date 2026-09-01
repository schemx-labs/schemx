/**
 * useForm - Schemx 表单实例的 Vue 生命周期适配。
 *
 * 负责创建由当前 Vue effect scope 持有的 SchemxInstance，并在 scope 销毁时
 * 自动释放实例。该模块不负责 provide/inject；表单上下文统一由
 * createFormContext() 注册，避免外部传入 form 时跳过上下文注册。
 *
 * @module hooks/useForm
 */
import { onScopeDispose } from "vue"

import { createForm, mergeSchemxConfig, type SchemxConfig } from "@schemx/core"

import { acquireVueFormRuntime, type VueSchemxInstance } from "../bridge"
import { getSchemxAppConfig } from "../config"
import { rendererRegistry as globalRendererRegistry } from "../utils/rendererProvider"
import { presetRuleRegistry as globalPresetRuleRegistry } from "../utils/presetRuleProvider"

import type { CreateFormOptions, NamePath, Values } from "@schemx/core"

/**
 * useForm 配置选项。
 *
 * 当前与 core 层 CreateFormOptions 保持一致，并在 Vue 层自动补充默认的
 * rendererRegistry 和 presetRuleRegistry。保留独立类型用于后续扩展
 * Vue 专属配置，而不污染 core 层接口。
 *
 * @typeParam TValues - 表单值类型
 */
export interface UseFormOptions<TValues extends Values> extends CreateFormOptions<
  TValues,
  NamePath<TValues>
> {}

/**
 * 创建由当前 Vue effect scope 持有的表单实例。
 *
 * useForm 只负责以下职责：
 * 1. 合并表单显式、App 安装和 Vue 层默认配置；
 * 2. 同步创建 SchemxInstance；
 * 3. 在当前 effect scope 销毁时调用 instance.destroy()。
 *
 * useForm 不再自动调用 provide()。需要向后代组件暴露实例时，应由
 * <SchemxForm> 或其他 Provider 组件显式调用 createFormContext(form)。
 * 这样无论实例是内部创建还是通过 props.form 外部传入，都能走同一条
 * 上下文注册路径，并保持清晰的实例所有权：谁创建，谁销毁。
 *
 * 该函数应在组件 setup() 或其他有效的 Vue effect scope 中同步调用。
 * 非 Vue 生命周期场景请直接使用 @schemx/core 的 createForm()，并自行销毁实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 表单创建配置
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
 * createFormContext(form)
 * ```
 */
export function useForm<TValues extends Values = Values>(
  options: UseFormOptions<TValues> = {}
): VueSchemxInstance<TValues> {
  // 按表单、App、Vue 包默认值的优先级解析可继承配置。
  const configuredOptions = mergeSchemxConfig<TValues>(
    getUseFormSchemxConfig(options),
    // App 安装配置以 Values 存储；在 useForm 边界关联到当前 TValues。
    getSchemxAppConfig() as SchemxConfig<TValues>,
    {
      rendererRegistry: globalRendererRegistry,
      presetRuleRegistry: globalPresetRuleRegistry,
    }
  )

  // 将已合并配置写入 Form 创建选项，避免 Core 再按较低优先级覆盖 Vue 结果。
  const mergedOptions: CreateFormOptions<TValues> = {
    ...options,
    ...configuredOptions,
  }

  // 表单实例是当前 scope 内的一次性资源，不需要使用 computed 包装。
  const instance = createForm<TValues>(mergedOptions)

  const acquired = acquireVueFormRuntime(instance)

  const form = acquired.runtime.instance

  // useForm 创建的实例归当前 effect scope 所有，因此由当前 scope 负责销毁。
  onScopeDispose(() => {
    acquired.release()
    form.destroy()
  })

  return form
}

/**
 * 从 useForm 选项中提取需要参与 Vue 优先级计算的可继承配置。
 *
 * @param options - useForm 的完整创建选项。
 * @returns 仅包含调用方实际提供字段的 SchemxConfig。
 */
function getUseFormSchemxConfig<TValues extends Values>(
  options: UseFormOptions<TValues>
): SchemxConfig<TValues> {
  const {
    schemaConfig = {},
    rendererProps = undefined,
    validatorAdapters = [],
    defaultRendererType = undefined,
    rendererRegistry = undefined,
    presetRuleRegistry = undefined,
  } = options

  return {
    schemaConfig,
    rendererProps,
    defaultRendererType,
    rendererRegistry,
    presetRuleRegistry,
    validatorAdapters,
  }
}
