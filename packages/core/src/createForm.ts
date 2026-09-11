/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责解析配置并装配 FormModel、SchemaRuntime
 * 与稳定的 SchemxInstance。
 *
 * @module core/createForm
 */

import { createSchemas, isSchemxSchemas } from "./createSchemas"
import { createFormApi, createFormInstance } from "./form/instance"
import { createFormModel } from "./form/model"
import { createFormObserver } from "./form/observer"
import { type CreateFormOptions, mergeCreateFormOptions } from "./form/options"
import { createPresetRuleRegistry, createRendererRegistry } from "./registry"
import { createSchemaRuntime } from "./runtime/createSchemaRuntime"

import type { SchemaRuntime } from "./runtime/createSchemaRuntime"
import type { SchemxInstance, Values } from "./types"

export type {
  CreateFormOptions,
  ResolvedCreateFormOptions,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
} from "./form/options"

/**
 * 创建 Schemx 表单实例。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 表单 Schema、初始值和生命周期回调配置。
 * @returns 可用于读取、更新、校验和销毁表单的稳定实例。
 *
 * @remarks
 * 创建过程会装配 Model、Runtime 和 Instance；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 所有 Form 子系统共享的标准化配置。
  const merged = mergeCreateFormOptions(options)

  const presetRuleRegistry = merged.presetRuleRegistry ?? createPresetRuleRegistry()

  const rendererRegistry =
    merged.rendererRegistry ?? createRendererRegistry(merged.defaultRendererType)

  // Form 统一持有 Schema source，Runtime 仅订阅并协调其变化。
  const schemas = isSchemxSchemas(merged.schemas)
    ? merged.schemas
    : createSchemas<TValues>(merged.schemas ?? [])

  // Form 持有的状态、值存储和校验模型。
  const model = createFormModel<TValues>({
    initialValues: merged.initialValues ?? ({} as TValues),
    presetRuleRegistry,
    validatorAdapters: [...(merged.validatorAdapters ?? [])],
    onRuleError: merged.onRuleError,
    validationConcurrency: merged.validationConcurrency,
  })

  // 防止销毁回调被重复执行。
  let disposed = false

  // 初始 Runtime 挂载成功后才会赋值的观察器清理函数。
  let disposeObserver = () => {}

  // 当前 Form 连接的 Runtime；销毁后释放，使公开 API 不再触达内部实现。
  let runtime: SchemaRuntime<TValues> | undefined

  const destroy = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    disposeObserver()
    runtime?.dispose()
    model.dispose()
    runtime = undefined
  }

  // 先组装公开实例；Runtime 引用会在下一步赋值。
  const instance = createFormInstance({
    model,
    getRuntime: () => runtime,
    getSchemas: () => (disposed ? undefined : schemas),
    callbacks: {
      onFinish: merged.onFinish,
      onFinishFailed: merged.onFinishFailed,
      onReset: merged.onReset,
      onLoadingChange: merged.onLoadingChange,
    },
    destroy,
    rendererRegistry,
    presetRuleRegistry,
  })

  // 传递给动态渲染器实现的轻量 API；直接复用公开实例能力。
  const formApi = createFormApi(instance)

  // 负责编译并协调当前 Schema 的 Runtime。
  runtime = createSchemaRuntime({
    schemas,
    store: model.store,
    validation: model.validation,
    instance,
    formApi,
    schemaConfig: merged.schemaConfig,
    fieldRules: merged.fieldRules,
    rendererProps: merged.rendererProps,
    lifecycleHooks: merged.lifecycleHooks,
    debug: merged.debug,
    schedulerOptions: merged.schedulerOptions,
  })

  try {
    runtime.mount()
    disposeObserver = createFormObserver(model, {
      onValuesChange: merged.onValuesChange,
      onFieldsChange: merged.onFieldsChange,
    })
  } catch (error) {
    destroy()
    throw error
  }

  return instance
}

export default createForm
