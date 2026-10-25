/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责先创建 FormConfig，再装配 FormModel、SchemaRuntime
 * 与稳定的 SchemxInstance。
 *
 * @module core/createForm
 */

import { setFormCreationConfig } from "./adapter"
import { getGlobalSchemxConfig } from "./config"
import { createSchemas, isSchemxSchemas } from "./createSchemas"
import {
  createFormConfig,
  createFormInstance,
  createFormModel,
  createFormObserver,
} from "./form"
import { createSchemaRuntime } from "./runtime"
import { createScope } from "./runtime/node"

import type { CreateFormOptions, SchemxConfig } from "./config"
import type { SchemxInstance, Values } from "./types"

export type {
  CreateFormOptions,
  ResolvedCreateFormOptions,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
} from "./config"

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
  return createFormWithSnapshot(
    options,
    getGlobalSchemxConfig() as SchemxConfig<TValues>,
    "global"
  )
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
  return createFormWithSnapshot(options, config, "explicit")
}

/**
 * 复用 Core 装配实现，为显式创建路径记录固定继承层。
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param options - 本次表单的完整创建选项。
 * @param config - 显式继承配置。
 * @param source - 全局路径省略继承记录；显式配置捕获快照；工厂快照保留原引用。
 * @example const form = createFormWithSnapshot(options, factoryDefaults)
 */
export function createFormWithSnapshot<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config: SchemxConfig<TValues>,
  source: "global" | "explicit" | "snapshot" = "snapshot"
): SchemxInstance<TValues> {
  // 按创建顺序登记资源，失败或销毁时按相反顺序释放。
  const scope = createScope()

  const destroy = scope.dispose

  try {
    // 配置是第一个业务模块，负责全部合并、默认值解析和创建选项固化。
    const configuration = createFormConfig<TValues>({
      defaults: config,
      config: options,
    })

    scope.add(configuration.dispose)

    const effectiveConfig = configuration.getConfig()

    const { rendererRegistry, presetRuleRegistry } = effectiveConfig

    // Form 持有 Schema source，实例数据和回调不参与共享配置合并。
    const schemaInput = options.schemas

    const schemas = isSchemxSchemas(schemaInput)
      ? schemaInput
      : createSchemas<TValues>(schemaInput ?? [])

    const model = createFormModel<TValues>({
      configuration,
      initialValues: options.initialValues ?? ({} as TValues),
      onRuleError: options.onRuleError,
    })

    scope.add(model.dispose)

    // 先创建稳定 Runtime；Compiler 和动态回调能力在挂载时注入。
    const runtime = createSchemaRuntime({
      schemas,
      store: model.store,
      validation: model.validation,
      schemaConfig: effectiveConfig.schemaConfig,
      fieldRules: options.fieldRules,
      rendererProps: effectiveConfig.rendererProps,
      lifecycleHooks: options.lifecycleHooks,
      debug: effectiveConfig.debug,
      schedulerOptions: effectiveConfig.schedulerOptions,
    })

    scope.add(runtime.dispose)

    const instance = createFormInstance({
      model,
      runtime,
      schemas,
      callbacks: {
        onFinish: options.onFinish,
        onFinishFailed: options.onFinishFailed,
        onReset: options.onReset,
        onLoadingChange: options.onLoadingChange,
      },
      destroy,
      rendererRegistry,
      presetRuleRegistry,
    })

    runtime.mount(instance)

    scope.add(
      createFormObserver(model, {
        onValuesChange: options.onValuesChange,
        onFieldsChange: options.onFieldsChange,
      })
    )

    const snapshotDefaults =
      source === "snapshot" ? config : configuration.inheritedConfig

    setFormCreationConfig(instance, {
      config: effectiveConfig,
      ...(source === "global" ? {} : { defaults: snapshotDefaults }),
    })

    return instance
  } catch (error) {
    destroy()
    throw error
  }
}

export default createForm
