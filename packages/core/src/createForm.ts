/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 根据继承配置来源装配配置、运行模块和公开实例。
 *
 * @module core/createForm
 */

import { setFormCreationConfig } from "./adapter"
import { setFormStateAdapterContext } from "./adapter/formStateAdapter/context"
import { createSchemaCompiler } from "./compiler"
import { createFormConfig, getGlobalSchemxConfig } from "./config"
import { createSchemas, isSchemxSchemas } from "./createSchemas"
import { createFormFieldRefs } from "./form/fieldRefs"
import { createFormObserver } from "./form/observer"
import { createFormRenderer } from "./form/renderer"
import { createFormSchemas } from "./form/schemas"
import { createFormStore } from "./form/store"
import { createFormValidation } from "./form/validation"
import { createNodeManager, createScope } from "./node"
import { batchUpdates, createReactiveScope, createSignal } from "./reactivity"
import { createReconciler } from "./reconciler"
import { createScheduler } from "./scheduler"
import { createStore } from "./store"
import { attachRootViewSchemas } from "./view"

import type { CreateFormOptions, SchemxConfig } from "./config"
import type { FormRuntimeContext } from "./runtimeContext"
import type { SchemxField, SchemxFormApi, SchemxInstance, Values } from "./types"

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
 * 创建过程会装配配置、运行模块和公开实例；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 * @example
 * const form = createForm({ schemaConfig: { readonly: true }, initialValues: { name: "" } })
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 独立创建继承全局配置；工厂创建传入固定快照。
  return createFormWithSnapshot(
    options,
    getGlobalSchemxConfig() as SchemxConfig<TValues>,
    "global"
  )
}

/**
 * 按固定继承层装配配置、运行模块和公开实例，失败或销毁时逆序释放资源。
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param options - 本次表单的完整创建选项。
 * @param config - 显式继承配置。
 * @param source - 全局路径省略继承记录；工厂快照保留原引用。
 * @example const form = createFormWithSnapshot(options, factoryDefaults)
 */
export function createFormWithSnapshot<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config: SchemxConfig<TValues>,
  source: "global" | "snapshot" = "snapshot"
): SchemxInstance<TValues> {
  // 所有表单资源只登记到此清单，销毁及初始化失败均按逆序清理。
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

    // Scheduler 由交互校验与节点依赖共同消费。
    const scheduler = createScheduler(effectiveConfig.schedulerOptions)

    scope.add(scheduler.dispose)

    // 节点索引、根作用域和表单级终态由同一 Form 持有。
    const nodeManager = createNodeManager<TValues>()

    // 根节点承载整棵表单树和视图订阅。
    const root = nodeManager.getRoot()

    // 字段引用、校验与 adapter 共用此表单级终态。
    const disposed = root.disposed

    scope.add(root.scope.dispose)
    scope.add(nodeManager.dispose)

    // 提交状态只由公开校验流程更新。
    const loading = createSignal(false)

    // 引用、校验和 adapter 共用同一表单级终态。
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
     * 将 source 更新提交给同一协调器，销毁后忽略晚到通知。
     * @param nextSchemas - source 发布的完整根 Schema。
     */
    const applySchemas = (nextSchemas: readonly SchemxField<TValues>[]): void => {
      if (!disposed.value) {
        reconciler.reconcile(nextSchemas)
      }
    }

    /**
     * 合并当前 Form 的一组响应式更新。
     * @param fn - 本批次执行的操作。
     */
    const batch: SchemxInstance<TValues>["batch"] = (fn) => {
      batchUpdates(fn)
    }

    /**
     * 等待依赖调度及后台任务完成；销毁后视为已完成。
     * @param timeout - 最大等待毫秒数，省略时使用调度器默认值。
     */
    const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (
      timeout
    ) => (disposed.value ? Promise.resolve(true) : scheduler.whenIdle(timeout))

    // 数据、引用和校验域直接消费已创建的基础资源。
    const storeDomain = createFormStore({ store, onReset: callbacks.onReset })

    const fieldRefs = createFormFieldRefs({ store, nodeManager, isDisposed })

    const validation = createFormValidation({
      store,
      configuration,
      onRuleError: options.onRuleError,
      nodeManager,
      scheduler,
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
      ...fieldRefs.api,
      setFieldRules: validation.rulesApi.setFieldRules,
      setFieldsRules: validation.rulesApi.setFieldsRules,
      removeFieldRules: validation.rulesApi.removeFieldRules,
      removeFieldsRules: validation.rulesApi.removeFieldsRules,
      validateField: validation.api.validateField,
      validate: validation.api.validate,
      isLoading: validation.api.isLoading,
    }

    // 数据和校验域已就绪，运行上下文直接持有完整的消费端 API。
    const context: FormRuntimeContext<TValues> = {
      get debug() {
        return configuration.getConfig().debug
      },
      getInstance,
      fieldRules: options.fieldRules ?? {},
      store,
      validator: validation.validator,
      nodeManager,
      scheduler,
      formApi,
    }

    // Compiler 的配置快照在公共资源创建后读取。
    const compiler = createSchemaCompiler<TValues>({ config: configuration.getConfig() })

    scope.add(compiler.invalidateConfigCache)

    // 依赖齐全后创建协调器，随后才允许挂载节点。
    const reconciler = createReconciler({
      compiler,
      context,
      lifecycleHooks: options.lifecycleHooks,
    })

    scope.add(reconciler.clear)

    // 取消函数在订阅建立后填入，清理顺序在初始化阶段确定。
    let unsubscribeSchemas: (() => void) | undefined

    scope.add(() => {
      unsubscribeSchemas?.()
      unsubscribeSchemas = undefined
    })
    scope.add(() => {
      disposed.value = true
    })

    attachRootViewSchemas(root)

    // Schema 域直接协调编译、配置更新与公开视图。
    const schemasDomain = createFormSchemas({
      root,
      compiler,
      reconciler,
      schemas,
      configuration,
    })

    // 实例仅组合各域明确提供的公开 API。
    const instance: SchemxInstance<TValues> = {
      ...storeDomain.api,
      ...validation.api,
      ...schemasDomain.api,
      ...renderer,
      ...validation.rulesApi,
      ...fieldRefs.api,
      effect,
      batch,
      waitForDependencies,
      destroy,
    }

    setFormStateAdapterContext(instance, { store, configuration, disposed, loading })

    // 完整实例就绪后才挂载节点，初值写入不触发 observer。
    applySchemas(schemas.peek())
    unsubscribeSchemas = schemas.subscribe(applySchemas)
    if (scope.disposed) {
      scope.add(unsubscribeSchemas)
    }

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

    setFormCreationConfig(instance, {
      config: effectiveConfig,
      ...(source === "global" ? {} : { defaults: config }),
    })

    return instance
  } catch (error) {
    destroy()
    throw error
  }
}

export default createForm
