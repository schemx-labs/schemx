/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责解析配置并装配 FormModel、SchemaRuntime、FormController
 * 与稳定的 SchemxInstance Facade。
 *
 * @module core/createForm
 */

import { createFormBindings } from "./form/bindings"
import { createFormController } from "./form/controller"
import { createFormApi, createFormFacade } from "./form/facade"
import { createFormModel, createRuntimeFormModelPort } from "./form/model"
import { createFormObserver } from "./form/observer"
import { type CreateFormOptions, resolveCreateFormOptions } from "./form/options"
import { createSchemaRuntime } from "./runtime/createSchemaRuntime"

import type { SchemxInstance, Values } from "./types"

export type { CreateFormOptions } from "./form/options"

/**
 * 创建 Schemx 表单实例。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 表单 Schema、初始值和生命周期回调配置。
 * @returns 可用于读取、更新、校验和销毁表单的稳定实例。
 *
 * @remarks
 * 创建过程会装配 Model、Runtime、Controller 和 Facade；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // Normalized configuration shared by every Form subsystem.
  const resolved = resolveCreateFormOptions(options)

  // State, value storage, and validation model owned by the Form.
  const model = createFormModel<TValues>({
    initialValues: resolved.initialValues,
    validationRuleRegistry: resolved.validationRuleRegistry,
    validatorAdapters: resolved.validatorAdapters,
    onRuleError: resolved.onRuleError,
  })

  // One-time connection container shared by the public facade and services.
  const bindings = createFormBindings<TValues>()

  // Lightweight API passed to dynamic renderer implementations.
  const formApi = createFormApi(model, bindings)

  // Stable public facade returned to the caller.
  const instance = createFormFacade({
    model,
    bindings,
    rendererRegistry: resolved.rendererRegistry,
    validationRuleRegistry: resolved.validationRuleRegistry,
  })

  // Runtime responsible for compiling and reconciling the current schemas.
  const runtime = createSchemaRuntime({
    model: createRuntimeFormModelPort(model),
    instance,
    formApi,
    defaultProps: resolved.defaultProps,
    defaultRendererType: resolved.defaultRendererType,
    lifecycleHooks: resolved.lifecycleHooks,
  })

  // Controller responsible for dependency-aware validation and submission.
  const controller = createFormController({
    model,
    runtime,
    callbacks: resolved.callbacks,
  })

  bindings.connect({ runtime, controller })

  // Guards the idempotent disposal callback.
  let disposed = false

  // Observer disposer assigned after the initial Runtime mount succeeds.
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
    runtime.mount(resolved.schemas)
    disposeObserver = createFormObserver(model, resolved.callbacks)
  } catch (error) {
    bindings.destroy()
    throw error
  }

  return instance
}

export default createForm
