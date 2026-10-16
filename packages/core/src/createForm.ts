/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责解析配置并装配 FormModel、SchemaRuntime
 * 与稳定的 SchemxInstance。
 *
 * @module core/createForm
 */

import { setFormCreationConfig } from "./adapter/formCreationConfig"
import { mergeConfig } from "./config/mergeSchemxConfig"
import { getGlobalSchemxConfig } from "./config/schemxConfig"
import { createSchemas, isSchemxSchemas } from "./createSchemas"
import { createFormApi, createFormInstance } from "./form/instance"
import { createFormModel } from "./form/model"
import { createFormObserver } from "./form/observer"
import { type CreateFormOptions, mergeCreateFormOptions } from "./form/options"
import { createSchemaRuntime } from "./runtime/createSchemaRuntime"

import type { SchemxConfig } from "./config/types"
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
 * @param options - 表单配置与实例选项；已合并配置也通过该参数传入，再由 Core 处理全局和内置默认值。
 * @returns 可用于读取、更新、校验和销毁表单的稳定实例。
 *
 * @remarks
 * 创建过程会装配 Model、Runtime 和 Instance；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 * @example
 * const form = createForm({ schemaConfig: { readonly: true }, initialValues: { name: "" } })
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 旧入口保留全局继承；框架工厂直接调用显式配置入口。
  return createFormWithSnapshot(options, getGlobalSchemxConfig() as SchemxConfig<TValues>)
}

/**
 * 使用显式继承配置创建表单，不读取 Core 全局配置。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 表单数据、局部配置和生命周期选项。
 * @param config - 显式提供的继承配置；空对象表示仅使用内置默认值。
 * @returns 由调用方负责销毁的同步表单实例。
 * @example
 * const form = createFormWithConfig({ initialValues: { name: "" } }, {})
 * form.destroy()
 */
export function createFormWithConfig<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config: SchemxConfig<TValues>
): SchemxInstance<TValues> {
  const defaults = mergeConfig(config)

  return createFormWithSnapshot(options, defaults, defaults)
}

/**
 * 复用 Core 装配实现，为显式创建路径记录固定继承层。
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param options - 本次表单的完整创建选项。
 * @param config - 显式继承配置。
 * @param defaults - 适配层动态覆盖撤销时使用的固定继承层。
 * @example const form = createFormWithSnapshot(options, config, config)
 */
export function createFormWithSnapshot<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config: SchemxConfig<TValues>,
  defaults?: Readonly<SchemxConfig<TValues>>
): SchemxInstance<TValues> {
  // 所有 Form 子系统共享同一份标准化配置。
  const merged = mergeCreateFormOptions(options, config)

  const presetRuleRegistry = merged.presetRuleRegistry

  const rendererRegistry = merged.rendererRegistry

  // Form 统一持有 Schema source，Runtime 仅订阅并协调其变化。
  const schemas = isSchemxSchemas(merged.schemas)
    ? merged.schemas
    : createSchemas<TValues>(merged.schemas ?? [])

  // Form 持有的状态、值存储和校验模型。
  const model = createFormModel<TValues>({
    initialValues: merged.initialValues,
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

  setFormCreationConfig(instance, {
    config: mergeConfig(merged),
    ...(defaults === undefined ? {} : { defaults }),
  })

  return instance
}

export default createForm
