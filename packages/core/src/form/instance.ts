import { createFieldController } from "../createField"
import { runSignalUntracked } from "../reactivity"
import { findFieldNode } from "../runtime/node"
import { shouldValidateOn, withLock } from "../utils"
import { createValidationCancelled } from "../validator"

import { createFormValidation, isFieldInteractive } from "./index"

import type { FormCallbackOptions } from "../config"
import type { SchemxFieldInstance } from "../createField"
import type { FormModel } from "./index"
import type { SchemxSchemas } from "../createSchemas"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchemaRuntime } from "../runtime"
import type { Store } from "../store"
import type { FieldValue, NamePath, SchemxInstance, Values } from "../types"
import type { ValidationResult, ValidationRuleIssue } from "../validator"

/**
 * 将公开错误消息转换为 Store 保存的 external 问题。
 *
 * @param messages - 要转换为 external 问题的公开错误消息。
 */
function toExternalIssues(messages: readonly string[]): readonly ValidationRuleIssue[] {
  return messages.map((message) => ({ type: "external", message, code: "external" }))
}

/**
 * 读取字段问题并转换为公开错误消息。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param store - 保存字段问题的 Store。
 * @param name - 要读取问题的字段路径。
 * @returns 当前字段的公开错误消息。
 */
function getFieldErrorMessages<TValues extends Values>(
  store: Store<TValues>,
  name: NamePath<TValues>
): readonly string[] {
  return store.getFieldErrors(name).map((issue) => issue.message)
}

/**
 * 读取多个字段问题并转换为公开错误消息。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param store - 保存字段问题的 Store。
 * @param names - 要读取的字段路径；省略时读取全部字段。
 * @returns 各字段及其公开错误消息的快照。
 */
function getFieldsErrorMessages<TValues extends Values>(
  store: Store<TValues>,
  names?: readonly NamePath<TValues>[]
): ReturnType<SchemxInstance<TValues>["getFieldsErrors"]> {
  return store.getFieldsErrors(names).map(({ field, errors }) => ({
    name: field,
    errors: errors.map((issue) => issue.message),
  }))
}

/**
 * Form 提交、重置和 loading 状态变化的生命周期回调。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export type FormCallbacks<TValues extends Values> = Pick<
  FormCallbackOptions<TValues>,
  "onFinish" | "onFinishFailed" | "onReset" | "onLoadingChange"
>

/**
 * 创建 Form 对外实例所需依赖。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateFormInstanceOptions<TValues extends Values> {
  /**
   * 保存表单数据、字段状态和校验器的 Model。
   */
  model: FormModel<TValues>
  /**
   * 当前 Form 持有的稳定 Runtime。
   */
  runtime: SchemaRuntime<TValues>
  /**
   * 当前 Form 持有的 Schema source。
   */
  schemas: SchemxSchemas<TValues>
  /**
   * 提交成功、失败、重置和 loading 状态变化时调用的回调。
   */
  callbacks: FormCallbacks<TValues>
  /**
   * 销毁底层 Form 并释放其资源的回调。
   */
  destroy: () => void
  /**
   * 当前 Form 使用的 Renderer 注册表。
   */
  rendererRegistry: RendererRegistry
  /**
   * 当前 Form 使用的命名校验规则注册表。
   */
  presetRuleRegistry: PresetRuleRegistry
}

/**
 * 创建 Form 对外暴露的完整实例。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model、Runtime、Schema source、生命周期回调和两个 Registry 实例。
 * @returns 稳定的 Form 实例对象。
 *
 * @remarks
 * Runtime 销毁后，视图读取返回空值，运行时操作按生命周期状态停止。
 * 通常由 {@link createForm} 间接调用，不建议业务代码直接组装底层依赖。
 *
 * @example
 * ```ts
 * const instance = createFormInstance(instanceOptions)
 * const values = instance.getFieldsValue()
 * ```
 */
export function createFormInstance<TValues extends Values>(
  options: CreateFormInstanceOptions<TValues>
): SchemxInstance<TValues> {
  // Form 持有资源生命周期；Instance 只组合公开命令与业务回调。
  const { model, callbacks, destroy, rendererRegistry, presetRuleRegistry } = options

  // 稳定的运行时引用，销毁判断通过其生命周期状态完成。
  const runtime = options.runtime

  // Schema 更新委托给同一 source，由 Runtime 订阅并协调。
  const schemaSource = options.schemas

  // 校验流程独立于公开实例创建，避免重新引入 Instance/Runtime 的循环装配。
  const {
    getFieldPathSignal,
    getFieldContext,
    validateField,
    setFieldRules,
    runFormValidation,
  } = createFormValidation({ model, runtime })

  /**
   * 更新提交流程状态并通知业务，与字段 pending 保持独立。
   * @param nextLoading - 本次提交是否仍在进行。
   */
  const setLoading = (nextLoading: boolean): void => {
    model.setLoading(nextLoading)
    callbacks.onLoadingChange?.(nextLoading)
  }

  // loading 直接读取 Model 的原生状态，不创建第二份提交标记。
  const isLoading: SchemxInstance<TValues>["isLoading"] = () => model.state.loading.value

  // 完整重置才派发 Form 回调，字段级重置继续直接委托 Store。
  const reset: SchemxInstance<TValues>["reset"] = () => {
    model.reset()
    callbacks.onReset?.()
  }

  // 节点字段按节点身份缓存；手动字段复用 Store 的稳定路径状态身份。
  const fields = new WeakMap<object, unknown>()

  // 字段控制器共享同一个 Runtime 活跃判断。
  const isActive = (): boolean => !runtime.isDisposed()

  // validate 与 submit 各自持有锁，避免两个公开入口意外共享同一 Promise。
  const validate: SchemxInstance<TValues>["validate"] = withLock(async () => {
    // 公开入口捕获版本，覆盖依赖等待与整个异步校验流程。
    const resetRevision = model.store.getResetRevision()

    // 内部流程只执行校验，最终取消检查放在最后一次 await 之后。
    const { result } = await runFormValidation(resetRevision)

    if (model.store.getResetRevision() !== resetRevision) {
      return createValidationCancelled(model.store.getFieldsSnapshot())
    }

    return result
  })

  // submit 额外负责值版本检查、loading 与业务回调，不调用带锁的 validate。
  const submit: SchemxInstance<TValues>["submit"] = withLock(async () => {
    // 必须早于 onLoadingChange；回调本身也可能同步触发表单重置。
    const resetRevision = model.store.getResetRevision()

    try {
      setLoading(true)

      // 值版本在内部等待依赖稳定后采样，依赖更新不会误作废本次提交。
      const { result, mutationRevision } = await runFormValidation(resetRevision)

      if (
        model.store.getResetRevision() !== resetRevision ||
        (result.valid && model.store.getMutationRevision() !== mutationRevision)
      ) {
        return createValidationCancelled(model.store.getFieldsSnapshot())
      }

      if (result.valid) {
        await callbacks.onFinish?.(result.values)
      } else if (!result.cancelled) {
        callbacks.onFinishFailed?.(result)
      }

      return result
    } finally {
      // 销毁或其他流程已结束 loading 时，不重复派发关闭回调。
      if (model.state.loading.value) {
        setLoading(false)
      }
    }
  })

  // 批量规则设置复用单字段入口，统一补齐 Schema 元数据。
  const setFieldsRules: SchemxInstance<TValues>["setFieldsRules"] = (fields) => {
    for (const field of fields) {
      setFieldRules(field.name, field.rules)
    }
  }

  // 撤销手动覆盖后恢复 Runtime 声明的规则。
  const removeFieldRules: SchemxInstance<TValues>["removeFieldRules"] = (path) => {
    model.validation.removeManualFieldRules(path)
  }

  // 批量撤销仍遵循单字段 Validator 的取消语义。
  const removeFieldsRules: SchemxInstance<TValues>["removeFieldsRules"] = (names) => {
    for (const name of names) {
      removeFieldRules(name)
    }
  }

  // 绑定多个字段错误写入方法，并转换公开错误字段名。
  const setFieldsErrors: SchemxInstance<TValues>["setFieldsErrors"] = (fields) => {
    model.store.setFieldsErrors(
      fields.map(({ name, errors }) => ({
        field: name,
        errors: toExternalIssues(errors),
      }))
    )
  }

  // Schema source 的生命周期由 Form 持有，销毁后拒绝更新。
  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) => {
    if (!runtime.isDisposed()) {
      schemaSource.set(schemas)
    }
  }

  // 委托基于当前 Schema 更新下一版 Schema。
  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) => {
    if (!runtime.isDisposed()) {
      schemaSource.update(updater)
    }
  }

  // 委托更新表单级 Schema 默认配置。
  const updateSchemaConfig: SchemxInstance<TValues>["updateSchemaConfig"] = (partial) => {
    if (!runtime.isDisposed()) {
      model.updateSchemaConfig(partial, runtime.setConfig)
    }
  }

  // 只替换消费配置，固定库默认值不受更新影响。
  const setConfig: SchemxInstance<TValues>["setConfig"] = (config) => {
    if (!runtime.isDisposed()) {
      model.setConfig(config, runtime.setConfig)
    }
  }

  // 读取当前已解析的视图 Schema；Runtime 销毁后返回空数组。
  const getViewSchemas: SchemxInstance<TValues>["getViewSchemas"] = () =>
    runtime.getViewSchemas()

  // 订阅视图 Schema 变化；Runtime 销毁后返回空清理函数。
  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => (runtime.isDisposed() ? () => {} : runtime.subscribeViewSchemas(callback))

  // 等待 Runtime 内部依赖调度完成；Runtime 销毁后视为已完成。
  const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (
    timeout
  ) => (runtime.isDisposed() ? Promise.resolve(true) : runtime.waitForIdle(timeout))

  // 公开读取只返回消息数组，Store 继续持有结构化问题。
  const getFieldErrors: SchemxInstance<TValues>["getFieldErrors"] = (name) =>
    getFieldErrorMessages(model.store, name)

  // 多字段错误沿用相同的公开消息转换。
  const getFieldsErrors: SchemxInstance<TValues>["getFieldsErrors"] = (names) =>
    getFieldsErrorMessages(model.store, names)

  // 写入显式标记为 external，保留错误来源。
  const setFieldErrors: SchemxInstance<TValues>["setFieldErrors"] = (name, errors) =>
    model.store.setFieldErrors(name, toExternalIssues(errors))

  // 共享 Registry 擦除了表单值与 Renderer 键的泛型；仅在此恢复公开读取契约。
  const getRendererEntry = rendererRegistry.resolveEntry.bind(
    rendererRegistry
  ) as SchemxInstance<TValues>["getRendererEntry"]

  // unknown 已包含描述符，注册操作统一委托 Registry。
  const registerRenderer: SchemxInstance<TValues>["registerRenderer"] = (
    type,
    renderer,
    registryOptions
  ) => {
    rendererRegistry.register(type, renderer, registryOptions)
  }

  // Form 支持运行期规则名称；Registry 的类型增强只约束其直接调用者。
  const getPresetRule = presetRuleRegistry.get.bind(
    presetRuleRegistry
  ) as SchemxInstance<TValues>["getPresetRule"]

  // 命名规则在运行期按字符串保存，此边界保留 Form 原有的注册契约。
  const registerPresetRule = presetRuleRegistry.register.bind(
    presetRuleRegistry
  ) as SchemxInstance<TValues>["registerPresetRule"]

  // 显式组装公开能力；Store 与 Registry 方法保留其接收者绑定。
  const instance: SchemxInstance<TValues> = {
    state: model.state,
    createField,
    changeField,
    blurField,
    setFieldValue: model.store.setFieldValue.bind(model.store),
    setFieldsValue: model.store.setFieldsValue.bind(model.store),
    getFieldValue: model.store.getFieldValue.bind(model.store),
    getFieldsValue: model.store.getFieldsValue.bind(model.store),
    getFieldSnapshot: model.store.getFieldSnapshot.bind(model.store),
    getFieldsSnapshot: model.store.getFieldsSnapshot.bind(model.store),
    getInitialValue: model.store.getInitialValue.bind(model.store),
    getInitialValues: model.store.getInitialValues.bind(model.store),
    setInitialValue: model.store.setInitialValue.bind(model.store),
    setInitialValues: model.store.setInitialValues.bind(model.store),
    isFieldTouched: model.store.isFieldTouched.bind(model.store),
    isFieldsTouched: model.store.isFieldsTouched.bind(model.store),
    setFieldTouched: model.store.setFieldTouched.bind(model.store),
    setFieldsTouched: model.store.setFieldsTouched.bind(model.store),
    getTouchedFields: model.store.getTouchedFields.bind(model.store),
    setFieldPending: model.store.setFieldPending.bind(model.store),
    setFieldsPending: model.store.setFieldsPending.bind(model.store),
    isFieldPending: model.store.isFieldPending.bind(model.store),
    isFieldsPending: model.store.isFieldsPending.bind(model.store),
    getPendingFields: model.store.getPendingFields.bind(model.store),
    isLoading,
    getFieldErrors,
    getFieldsErrors,
    setFieldErrors,
    setFieldsErrors,
    clearFieldErrors: model.store.clearFieldErrors.bind(model.store),
    clearFieldsErrors: model.store.clearFieldsErrors.bind(model.store),
    clearErrors: model.store.clearAllErrors.bind(model.store),
    setFieldRules,
    setFieldsRules,
    removeFieldRules,
    removeFieldsRules,
    resetField: model.store.resetField.bind(model.store),
    resetFields: model.store.resetFields.bind(model.store),
    reset,
    validateField,
    validate,
    submit,
    effect: model.effect.bind(model),
    batch: model.batch.bind(model),
    setSchemas,
    updateSchemas,
    updateSchemaConfig,
    setConfig,
    getViewSchemas,
    subscribeViewSchemas,
    waitForDependencies,
    getRenderer: rendererRegistry.resolve.bind(rendererRegistry),
    getRendererEntry,
    registerRenderer,
    hasRenderer: rendererRegistry.has.bind(rendererRegistry),
    getPresetRule,
    registerPresetRule,
    hasPresetRule: presetRuleRegistry.has.bind(presetRuleRegistry),
    destroy,
  }

  // 以下动作需要完整的实例身份；函数声明可在组装时引用，执行时实例已就绪。
  /**
   * 用户交互先同步提交状态和业务回调，再复用单字段校验流程。
   * @typeParam TName - 当前字段路径。
   * @param name - 本次交互绑定的路径。
   * @param event - change 或 blur 事件。
   * @param value - change 写入的新值；blur 忽略此参数。
   * @param signal - 交互开始时捕获的路径取消信号。
   */
  async function interactField<TName extends NamePath<TValues>>(
    name: TName,
    event: "change" | "blur",
    value?: FieldValue<TValues, TName>,
    signal?: AbortSignal
  ): Promise<ValidationResult<TValues, TName> | undefined> {
    if (runtime.isDisposed() || signal?.aborted) {
      return undefined
    }

    // 业务回调读取交互开始时的配置，自动校验随后重新检查最新配置。
    const context = getFieldContext(name)

    if (!isFieldInteractive(context)) {
      return undefined
    }

    // 业务回调和状态订阅都可能同步重置表单。
    const resetRevision = model.store.getResetRevision()

    model.batch(() => {
      if (event === "change") {
        model.store.setFieldValue(name, () => value)
      }

      model.store.setFieldTouched(name, true)
    })

    if (
      signal?.aborted ||
      runtime.isDisposed() ||
      model.store.getResetRevision() !== resetRevision
    ) {
      return createValidationCancelled<TValues>(model.store.getFieldsSnapshot())
    }

    if (event === "change") {
      context.onChange?.(value, instance)
    } else {
      context.onBlur?.(instance)
    }

    if (
      signal?.aborted ||
      runtime.isDisposed() ||
      model.store.getResetRevision() !== resetRevision
    ) {
      return createValidationCancelled<TValues>(model.store.getFieldsSnapshot())
    }

    if (!shouldValidateOn(event, getFieldContext(name).validationTrigger)) {
      return undefined
    }

    return validateField(name, event, signal)
  }

  /**
   * 进入异步流程前捕获路径，数组移动后旧事件不会写入替换字段。
   * @typeParam TName - 本次交互的字段路径。
   * @param name - 操作开始时的路径。
   * @param value - 用户提交的新字段值。
   */
  function changeField<TName extends NamePath<TValues>>(
    name: TName,
    value: FieldValue<TValues, TName> | undefined
  ): Promise<ValidationResult<TValues, TName> | undefined> {
    return interactField(name, "change", value, getFieldPathSignal(name))
  }

  /**
   * 复用交互守卫，保持触摸、回调与校验的顺序。
   * @typeParam TName - 本次交互的字段路径。
   * @param name - 操作开始时的路径。
   */
  function blurField<TName extends NamePath<TValues>>(
    name: TName
  ): Promise<ValidationResult<TValues, TName> | undefined> {
    return interactField(name, "blur", undefined, getFieldPathSignal(name))
  }

  /**
   * 控制器绑定一次；后续命中缓存时保留其身份和订阅。
   * @typeParam TName - 初始定位路径，用于推导字段值类型。
   * @param name - 创建控制器时的字段路径。
   */
  function createField<TName extends NamePath<TValues>>(
    name: TName
  ): SchemxFieldInstance<TValues, TName> {
    if (runtime.isDisposed() || model.disposed.peek()) {
      throw new Error("[schemx] Form has been destroyed.")
    }

    // 定位过程不向调用方的响应式 effect 引入节点树依赖。
    const node = runSignalUntracked(() => findFieldNode(runtime.root, name))

    // 手动字段以稳定路径状态为键，避免与后挂载的同名节点混用。
    const owner = node ?? model.state.field(name)

    // 异构路径控制器只在返回边界恢复当前路径泛型。
    const cached = fields.get(owner)

    if (cached) {
      return cached as SchemxFieldInstance<TValues, TName>
    }

    // 字段方法继续经过公开 Form 命令，保留业务拦截点。
    const field = createFieldController({
      form: instance,
      name,
      node,
      disposed: model.disposed,
      isActive,
    })

    fields.set(owner, field)

    return field
  }

  return instance
}
