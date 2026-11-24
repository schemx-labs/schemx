/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 根据继承配置来源装配配置、运行模块和公开实例。
 *
 * @module core/createForm
 */

import { setFormCreationConfig } from "./adapter"
import { setFormStateAdapterContext } from "./adapter/formStateAdapter/context"
import { createFormConfig } from "./config"
import { createSchemas, isSchemxSchemas } from "./createSchemas"
import { createFormDictionary } from "./form/dictionary"
import { createFormObserver } from "./form/observer"
import { createFormRenderer } from "./form/renderer"
import { createFormSchemas } from "./form/schemas"
import { createFormStore } from "./form/store"
import { createFormValidation } from "./form/validation"
import { batchUpdates, createReactiveScope, createSignal } from "./reactivity"
import { createSchemaRuntime } from "./runtime"
import { createScope } from "./scope"
import { createStore } from "./store"

import type { CreateFormOptions, SchemxConfig } from "./config"
import type { SchemxFormApi, SchemxInstance, Values } from "./types"

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
 * @param options - 表单配置与实例选项；已合并配置也通过该参数传入，再由 Core 补齐内置默认值。
 * @returns 可用于读取、更新、校验和销毁表单的稳定实例。
 *
 * @remarks
 * 创建过程会装配配置、运行模块和公开实例；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 * @example
 * const form = createForm({ schemaConfig: { readonly: true }, initialValues: { name: "" } })
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 独立创建仅使用本次配置；工厂创建另行传入固定快照。
  return createFormWithSnapshot(options)
}

/**
 * 按固定继承层装配配置、运行模块和公开实例，失败或销毁时逆序释放资源。
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param options - 本次表单的完整创建选项。
 * @param config - 工厂创建时的继承快照；省略时只使用本次选项和内置默认值。
 * @example const form = createFormWithSnapshot(options, factoryDefaults)
 */
export function createFormWithSnapshot<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config?: SchemxConfig<TValues>
): SchemxInstance<TValues> {
  // 所有表单资源只登记到此清单，销毁及初始化失败均按逆序清理。
  const scope = createScope()

  const destroy = scope.dispose

  try {
    // 配置是第一个业务模块，负责全部合并、默认值解析和创建选项固化。
    const configuration = createFormConfig<TValues>({
      ...(config === undefined ? {} : { defaults: config }),
      config: options,
    })

    scope.add(configuration.dispose)

    const effectiveConfig = configuration.getConfig()

    // Form 持有 Schema source，实例数据和回调不参与共享配置合并。
    const schemaInput = options.schemas

    const schemas = isSchemxSchemas(schemaInput)
      ? schemaInput
      : createSchemas<TValues>(schemaInput ?? [])

    // 表单操作和提交、重置事件共享同一份回调。
    const callbacks = {
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onReset: options.onReset,
      onLoadingChange: options.onLoadingChange,
    }

    // Store 由 Form 创建，并在校验域及其他运行资源之后释放。
    const store = createStore<TValues>({
      initialValues: options.initialValues ?? ({} as TValues),
    })

    scope.add(store.destroy.bind(store))

    // 校验域稍后创建；清理位置提前确定，保证它晚于 effect、早于 Store 释放。
    let disposeValidation: (() => void) | undefined

    scope.add(() => {
      disposeValidation?.()
      disposeValidation = undefined
    })

    // 公开 effect 在节点和调度器释放后停止。
    const effectScope = createReactiveScope()

    scope.add(effectScope.dispose)

    // 公开实例及 observer 使用同一副作用注册入口。
    const effect = effectScope.effect

    // Runtime 先提供校验、字典和 adapter 所需的读取接口。
    const runtime = createSchemaRuntime({
      config: effectiveConfig,
      lifecycleHooks: options.lifecycleHooks,
    })

    scope.add(runtime.dispose)

    // 表单域和节点域共享这些运行资源。
    const { disposed, fields, waitForDependencies } = runtime

    // 提交状态只由公开校验流程更新。
    const loading = createSignal(false)

    // 校验和 adapter 共用同一表单级终态。
    const isDisposed = (): boolean => disposed.value

    // 域内回调只在完整实例就绪后执行。
    const getInstance = (): SchemxInstance<TValues> => instance

    /**
     * 更新表单提交状态并通知业务回调。
     * @param value - 当前是否正在提交。
     */
    const setLoading = (value: boolean): void => {
      loading.value = value
      callbacks.onLoadingChange?.(value)
    }

    /**
     * 合并当前 Form 的一组响应式更新。
     * @param fn - 本批次执行的操作。
     */
    const batch: SchemxInstance<TValues>["batch"] = (fn) => {
      batchUpdates(fn)
    }

    // 数据和校验域直接消费已创建的基础资源。
    const storeDomain = createFormStore({ store, onReset: callbacks.onReset })

    const validation = createFormValidation({
      store,
      configuration,
      onRuleError: options.onRuleError,
      fields,
      waitForRuntimeIdle: waitForDependencies,
      isDisposed,
      loading,
      setLoading,
      callbacks,
      getInstance,
    })

    disposeValidation = validation.dispose

    const renderer = createFormRenderer<TValues>(effectiveConfig.rendererRegistry)

    // 消费端 API 复用同一方法和锁，显式排除提交、交互及注册表能力。
    const formApi: SchemxFormApi<TValues> = {
      ...storeDomain.api,
      setFieldRules: validation.rulesApi.setFieldRules,
      setFieldsRules: validation.rulesApi.setFieldsRules,
      removeFieldRules: validation.rulesApi.removeFieldRules,
      removeFieldsRules: validation.rulesApi.removeFieldsRules,
      validateField: validation.api.validateField,
      validate: validation.api.validate,
      isLoading: validation.api.isLoading,
    }

    // 校验域就绪后连接运行时，首次业务挂载在公开实例组装之后。
    const tree = runtime.connect({
      getInstance,
      getRendererDictionary: (type) =>
        effectiveConfig.rendererRegistry.getEntry(type)?.dictionary,
      fieldRules: options.fieldRules ?? {},
      store,
      validator: validation.validator,
      formApi,
    })

    // Schema 域负责首次提交和后续输入。
    const schemasDomain = createFormSchemas({ disposed, tree, schemas, configuration })

    scope.add(schemasDomain.dispose)
    scope.add(runtime.markDisposed)

    // 字典方法按路径解析字段节点，不持有字段身份。
    const dictionary = createFormDictionary({ fields, isDisposed })

    // 实例仅组合各域明确提供的公开 API。
    const instance: SchemxInstance<TValues> = {
      ...storeDomain.api,
      ...validation.api,
      ...schemasDomain.api,
      ...dictionary,
      ...renderer,
      ...validation.rulesApi,
      effect,
      batch,
      waitForDependencies,
      destroy,
    }

    setFormStateAdapterContext(instance, { store, configuration, disposed, loading })

    // 完整实例就绪后才挂载节点，初值写入不触发 observer。
    schemasDomain.mount()

    scope.add(
      createFormObserver(
        store,
        {
          onValuesChange: options.onValuesChange,
          onFieldsChange: options.onFieldsChange,
        },
        effect
      )
    )

    setFormCreationConfig<TValues>(instance, {
      config: effectiveConfig,
      ...(config === undefined ? {} : { defaults: config }),
    })

    return instance
  } catch (error) {
    destroy()
    throw error
  }
}

export default createForm
