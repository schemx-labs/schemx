/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责解析配置并装配 FormModel、SchemaRuntime、FormController
 * 与稳定的 SchemxInstance。
 *
 * @module core/createForm
 */

import { createFormBindings } from "./form/bindings"
import { createFormController } from "./form/controller"
import { createFormApi, createFormInstance } from "./form/instance"
import { createFormModel, createRuntimeFormModelPort } from "./form/model"
import { createFormObserver } from "./form/observer"
import { type CreateFormOptions, mergeCreateFormOptions } from "./form/options"
import { createRendererRegistry, createValidationRuleRegistry } from "./registry"
import { createSchemaRuntime } from "./runtime/createSchemaRuntime"

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
 * 创建过程会装配 Model、Runtime、Controller 和 Instance；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 所有 Form 子系统共享的标准化配置。
  const merged = mergeCreateFormOptions(options)

  const validationRuleRegistry =
    merged.validationRuleRegistry ?? createValidationRuleRegistry()

  const rendererRegistry =
    merged.rendererRegistry ?? createRendererRegistry(merged.defaultRendererType)

  // Form 持有的状态、值存储和校验模型。
  const model = createFormModel<TValues>({
    initialValues: merged.initialValues ?? ({} as TValues),
    validationRuleRegistry,
    validatorAdapters: [...(merged.validatorAdapters ?? [])],
    onRuleError: merged.onRuleError,
    validationConcurrency: merged.validationConcurrency,
  })

  // 由公开实例与服务共享、只连接一次的绑定容器。
  const bindings = createFormBindings<TValues>()

  // 传递给动态渲染器实现的轻量 API。
  const formApi = createFormApi(model, bindings)

  // 返回给调用方的稳定公开实例。
  const instance = createFormInstance({
    model,
    bindings,
    rendererRegistry,
    validationRuleRegistry,
  })

  // 负责编译并协调当前 Schema 的 Runtime。
  const runtime = createSchemaRuntime({
    model: createRuntimeFormModelPort(model),
    instance,
    formApi,
    schemaConfig: merged.schemaConfig,
    rendererProps: merged.rendererProps,
    defaultRendererType: merged.defaultRendererType,
    lifecycleHooks: merged.lifecycleHooks,
    debug: merged.debug,
    schedulerOptions: merged.schedulerOptions,
  })

  // 负责依赖感知校验与提交的 Controller。
  const controller = createFormController({
    model,
    runtime,
    callbacks: {
      onFinish: merged.onFinish,
      onFinishFailed: merged.onFinishFailed,
      onReset: merged.onReset,
      onLoadingChange: merged.onLoadingChange,
    },
  })

  bindings.connect({ runtime, controller })

  // 防止销毁回调被重复执行。
  let disposed = false

  // 初始 Runtime 挂载成功后才会赋值的观察器清理函数。
  let disposeObserver = () => {}

  bindings.setDestroy(() => {
    if (disposed) {
      return
    }

    disposed = true
    disposeObserver()
    runtime.dispose()
    model.dispose()
    bindings.disconnect()
  })

  try {
    runtime.mount(merged.schemas)
    disposeObserver = createFormObserver(model, {
      onValuesChange: merged.onValuesChange,
      onFieldsChange: merged.onFieldsChange,
    })
  } catch (error) {
    bindings.destroy()
    throw error
  }

  return instance
}

export default createForm
