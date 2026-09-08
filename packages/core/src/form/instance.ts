import { createSignal } from "../reactivity"
import { withLock } from "../utils"

import type { FormModel } from "./model"
import type { SchemxSchemas } from "../createSchemas"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchemaRuntime } from "../runtime/createSchemaRuntime"
import type { Store } from "../store"
import type { NamePath, SchemxFormApi, SchemxInstance, Values } from "../types"
import type {
  FieldValidationConfig,
  ValidationFailure,
  ValidationResult,
  ValidationRuleIssue,
} from "../validator"

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
): readonly { readonly name: NamePath<TValues>; readonly errors: readonly string[] }[] {
  return store.getFieldsErrors(names).map(({ field, errors }) => ({
    name: field,
    errors: errors.map((issue) => issue.message),
  }))
}

/**
 * Form 校验完成后的生命周期回调。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormCallbacks<TValues extends Values> {
  /**
   * 校验成功后接收只读值快照的回调。
   */
  onFinish?: (values: Readonly<TValues>) => void | Promise<void>
  /**
   * 校验失败后接收失败详情的回调。
   */
  onFinishFailed?: (failure: ValidationFailure<TValues>) => void
  /**
   * 完整表单重置完成后调用。
   */
  onReset?: () => void
  /**
   * 提交流程状态变化时调用。
   */
  onLoadingChange?: (loading: boolean) => void
}

/**
 * 创建 Form 对外实例所需依赖。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateFormInstanceOptions<TValues extends Values> {
  model: FormModel<TValues>
  getRuntime: () => SchemaRuntime<TValues> | undefined
  getSchemas: () => SchemxSchemas<TValues> | undefined
  callbacks: FormCallbacks<TValues>
  destroy: () => void
  rendererRegistry: RendererRegistry
  presetRuleRegistry: PresetRuleRegistry
}

/**
 * 复用公开实例的方法，创建传递给动态 renderer 的轻量 Form API。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param instance - 提供字段状态、校验和规则操作的公开 Form 实例。
 * @returns 面向动态 renderer 的 Form API。
 *
 * @example
 * ```ts
 * const formApi = createFormApi(instance)
 * const values = formApi.getFieldsValue()
 * ```
 */
export function createFormApi<TValues extends Values>(
  instance: SchemxInstance<TValues>
): SchemxFormApi<TValues> {
  return {
    setFieldValue: instance.setFieldValue,
    setFieldsValue: instance.setFieldsValue,
    getFieldValue: instance.getFieldValue,
    getFieldsValue: instance.getFieldsValue,
    getFieldSnapshot: instance.getFieldSnapshot,
    getFieldsSnapshot: instance.getFieldsSnapshot,
    getInitialValue: instance.getInitialValue,
    getInitialValues: instance.getInitialValues,
    setInitialValue: instance.setInitialValue,
    setInitialValues: instance.setInitialValues,
    isFieldTouched: instance.isFieldTouched,
    isFieldsTouched: instance.isFieldsTouched,
    getTouchedFields: instance.getTouchedFields,
    setFieldTouched: instance.setFieldTouched,
    setFieldsTouched: instance.setFieldsTouched,
    isFieldPending: instance.isFieldPending,
    isFieldsPending: instance.isFieldsPending,
    getPendingFields: instance.getPendingFields,
    setFieldPending: instance.setFieldPending,
    setFieldsPending: instance.setFieldsPending,
    resetField: instance.resetField,
    resetFields: instance.resetFields,
    getFieldErrors: instance.getFieldErrors,
    getFieldsErrors: instance.getFieldsErrors,
    setFieldErrors: instance.setFieldErrors,
    setFieldsErrors: instance.setFieldsErrors,
    clearFieldErrors: instance.clearFieldErrors,
    clearFieldsErrors: instance.clearFieldsErrors,
    setFieldRules: instance.setFieldRules,
    setFieldsRules: instance.setFieldsRules,
    removeFieldRules: instance.removeFieldRules,
    removeFieldsRules: instance.removeFieldsRules,
    reset: instance.reset,
    validateField: instance.validateField,
    validate: instance.validate,
  }
}

/**
 * 创建 Form 对外暴露的完整实例。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model、Runtime 访问器、生命周期回调和两个 Registry 实例。
 * @returns 稳定的 Form 实例对象。
 *
 * @remarks
 * Runtime 断开后，读操作返回安全的空值，写操作不再触发已销毁的 Runtime。
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
  const { model, callbacks, destroy, rendererRegistry, presetRuleRegistry } = options

  const getRuntime = options.getRuntime

  const getSchemas = options.getSchemas

  // 提交流程状态必须独立于字段 pending，便于 UI 区分表单提交与字段异步操作。
  const loading = createSignal(false)

  const setLoading = (nextLoading: boolean): void => {
    loading.value = nextLoading
    callbacks.onLoadingChange?.(nextLoading)
  }

  const isLoading: SchemxInstance<TValues>["isLoading"] = () => loading.value

  const reset: SchemxInstance<TValues>["reset"] = () => {
    model.reset()
    callbacks.onReset?.()
  }

  const validateField: SchemxInstance<TValues>["validateField"] = async (name) => {
    await getRuntime()?.waitForCriticalIdle()

    return model.validation.validateField(name, model.store.getFieldsValue())
  }

  const validateAfterIdle = async (): Promise<ValidationResult<TValues>> => {
    const pendingFields = model.store.getPendingFields()

    if (pendingFields.length > 0) {
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((item) => item.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        valid: false,
        values: model.store.getFieldsSnapshot(),
        errors: pendingFields.map(({ field, message }) => {
          const messages = message.length ? message : ["字段正在处理中，请稍后重试"]

          model.store.setFieldErrors(
            field as NamePath<TValues>,
            messages.map((message) => ({
              type: "external",
              message,
              code: "pending",
            }))
          )

          return {
            scope: "field" as const,
            name: field as NamePath<TValues>,
            issues: messages.map((item) => ({
              type: "external" as const,
              message: item,
              code: "pending",
            })) as [
              { type: "external"; message: string; code: string },
              ...{ type: "external"; message: string; code: string }[],
            ],
          }
        }),
      }
    }

    return model.validation.validate(model.store.getFieldsValue())
  }

  const validate: SchemxInstance<TValues>["validate"] = withLock(async () => {
    const depsReady = await getRuntime()?.waitForCriticalIdle()

    if (!depsReady) {
      return createDependencyTimeoutResult(model.store.getFieldsSnapshot())
    }

    return validateAfterIdle()
  })

  const submit: SchemxInstance<TValues>["submit"] = withLock(async () => {
    try {
      setLoading(true)

      const depsReady = await getRuntime()?.waitForCriticalIdle()

      if (!depsReady) {
        return createDependencyTimeoutResult(model.store.getFieldsSnapshot())
      }

      const result = await validateAfterIdle()

      if (result.valid) {
        await callbacks.onFinish?.(result.values)
      } else if (!result.cancelled) {
        callbacks.onFinishFailed?.(result)
      }

      return result
    } finally {
      if (loading.value) {
        setLoading(false)
      }
    }
  })

  const setFieldRules: SchemxInstance<TValues>["setFieldRules"] = (path, rules) => {
    // 外部只传入 rules；label/required 由 Runtime 的有效 Schema 内部补齐。
    const effective = getRuntime()?.getEffectiveFieldSchema(path)

    const config: FieldValidationConfig<TValues, typeof path> = {
      name: path,
      label: effective?.label ?? "",
      required: (effective?.required ?? false) as FieldValidationConfig<
        TValues,
        typeof path
      >["required"],
    }

    model.validation.setFieldConfig(config)
    model.validation.setFieldRules(path, rules)
  }

  const setFieldsRules: SchemxInstance<TValues>["setFieldsRules"] = (fields) => {
    for (const field of fields) {
      setFieldRules(field.name, field.rules)
    }
  }

  const removeFieldRules: SchemxInstance<TValues>["removeFieldRules"] = (path) => {
    model.validation.removeFieldRules(path)
  }

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

  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) =>
    getSchemas()?.set(schemas)

  // 委托基于当前 Schema 更新下一版 Schema。
  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) =>
    getSchemas()?.update(updater)

  // 委托更新表单级 Schema 默认配置。
  const updateSchemaConfig: SchemxInstance<TValues>["updateSchemaConfig"] = (partial) =>
    getRuntime()?.updateSchemaConfig(partial)

  // 读取当前已解析的视图 Schema；Runtime 断开后返回空数组。
  const getViewSchemas: SchemxInstance<TValues>["getViewSchemas"] = () =>
    getRuntime()?.getViewSchemas() ?? []

  // 订阅视图 Schema 变化；Runtime 断开后返回空清理函数。
  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => getRuntime()?.subscribeViewSchemas(callback) ?? (() => {})

  // 等待 Runtime 内部依赖调度完成；Runtime 断开后视为已完成。
  const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (timeout) =>
    getRuntime()?.waitForIdle(timeout) ?? Promise.resolve(true)

  return {
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
    getFieldErrors: (name) => getFieldErrorMessages(model.store, name),
    getFieldsErrors: (names) => getFieldsErrorMessages(model.store, names),
    setFieldErrors: (name, errors) =>
      model.store.setFieldErrors(name, toExternalIssues(errors)),
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
    effect: model.effect,
    batch: model.batch,
    setSchemas,
    updateSchemas,
    updateSchemaConfig,
    getViewSchemas,
    subscribeViewSchemas,
    waitForDependencies,
    getRenderer: rendererRegistry.resolve.bind(rendererRegistry),
    registerRenderer: rendererRegistry.register.bind(rendererRegistry),
    hasRenderer: rendererRegistry.has.bind(rendererRegistry),
    getPresetRule: presetRuleRegistry.get.bind(
      presetRuleRegistry
    ) as SchemxInstance<TValues>["getPresetRule"],
    registerPresetRule: presetRuleRegistry.register.bind(
      presetRuleRegistry
    ) as SchemxInstance<TValues>["registerPresetRule"],
    hasPresetRule: presetRuleRegistry.has.bind(presetRuleRegistry),
    destroy,
  }
}

/**
 * 创建依赖解析超时的表单级失败结果。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param values - 超时发生时应保留的表单值快照。
 * @returns 表示依赖解析超时的失败结果。
 */
function createDependencyTimeoutResult<TValues extends Values>(
  values: TValues
): ValidationResult<TValues> {
  return {
    valid: false,
    values,
    errors: [
      {
        scope: "form",
        issues: [
          {
            type: "validation",
            message: "表单依赖解析超时，请稍后重试",
            code: "dependency_timeout",
          },
        ],
      },
    ],
  }
}
