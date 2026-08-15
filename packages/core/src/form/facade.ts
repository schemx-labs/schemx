import type { FormBindings } from "./bindings"
import type { FormModel } from "./model"
import type { RendererRegistry, ValidationRuleRegistry } from "../registry"
import type { NamePath, SchemxFormApi, SchemxInstance, Values } from "../types"

/**
 * 创建传递给动态 renderer 的轻量 Form API。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param model - 提供值、错误和批处理能力的 FormModel。
 * @param bindings - 提供 Runtime/Controller 生命周期访问的 binding。
 * @returns 面向动态 renderer 的 Form API。
 */
export function createFormApi<TValues extends Values>(
  model: FormModel<TValues>,
  bindings: FormBindings<TValues>
): SchemxFormApi<TValues> {
  // 把公开的 errors 字段转换为内部 messages 字段。
  const setFieldsErrors: SchemxFormApi<TValues>["setFieldsErrors"] = (fields) => {
    model.validation.setFieldsErrors(
      fields.map(({ name, errors }) => ({ name, messages: errors }))
    )
  }

  // 绑定 Controller 的规则操作；未连接 Runtime 时保持 no-op 语义。
  const setFieldRules: SchemxFormApi<TValues>["setFieldRules"] = (name, rules) =>
    bindings.getConnectedController()?.setFieldRules(name, rules)

  const setFieldsRules: SchemxFormApi<TValues>["setFieldsRules"] = (fields) =>
    bindings.getConnectedController()?.setFieldsRules(fields)

  const removeFieldRules: SchemxFormApi<TValues>["removeFieldRules"] = (name) =>
    bindings.getConnectedController()?.removeFieldRules(name)

  const removeFieldsRules: SchemxFormApi<TValues>["removeFieldsRules"] = (names) =>
    bindings.getConnectedController()?.removeFieldsRules(names)

  /**
   * 通过已连接的 Controller 校验字段；未连接时回退到本地 Validator。
   */
  const validateField: SchemxFormApi<TValues>["validateField"] = (name) =>
    bindings.getConnectedController()?.validateField(name) ??
    model.validation.validateField(name, model.store.getFieldsValue())

  /**
   * 通过已连接的 Controller 校验整个表单；未连接时回退到本地 Validator。
   */
  const validate: SchemxFormApi<TValues>["validate"] = () =>
    bindings.getConnectedController()?.validate() ??
    model.validation.validate(model.store.getFieldsValue())

  /**
   * 通过已连接的 Controller 重置整表，确保生命周期回调一致。
   */
  const reset: SchemxFormApi<TValues>["reset"] = () =>
    bindings.getConnectedController()?.reset() ?? model.reset()

  function clearErrors(): void
  function clearErrors<TName extends NamePath<TValues>>(name: TName): void
  function clearErrors(name?: NamePath<TValues>): void {
    if (name === undefined) {
      model.validation.clearErrors()

      return
    }

    model.validation.clearFieldErrors(name)
  }

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
    getTouchedFields: model.store.getTouchedFields.bind(model.store),
    setFieldTouched: model.store.setFieldTouched.bind(model.store),
    setFieldsTouched: model.store.setFieldsTouched.bind(model.store),
    isFieldPending: model.store.isFieldPending.bind(model.store),
    isFieldsPending: model.store.isFieldsPending.bind(model.store),
    getPendingFields: model.store.getPendingFields.bind(model.store),
    setFieldPending: model.store.setFieldPending.bind(model.store),
    setFieldsPending: model.store.setFieldsPending.bind(model.store),
    resetField: model.store.resetField.bind(model.store),
    resetFields: model.store.resetFields.bind(model.store),
    getFieldErrors: model.validation.getFieldErrors.bind(model.validation),
    getFieldsErrors: model.validation.getFieldsErrors.bind(model.validation),
    setFieldErrors: model.validation.setFieldErrors.bind(model.validation),
    setFieldsErrors,
    clearFieldErrors: model.validation.clearFieldErrors.bind(model.validation),
    clearFieldsErrors: model.validation.clearFieldsErrors.bind(model.validation),
    setFieldRules,
    setFieldsRules,
    removeFieldRules,
    removeFieldsRules,
    setValue: model.store.setFieldValue.bind(model.store),
    setValues: model.store.setFieldsValue.bind(model.store),
    getValue: model.store.getFieldValue.bind(model.store),
    getValues: model.store.getFieldsValue.bind(model.store),
    getSnapshot: model.store.getFieldSnapshot.bind(model.store),
    getSnapshots: model.store.getFieldsSnapshot.bind(model.store),
    setPending: model.store.setFieldPending.bind(model.store),
    isPending: model.store.isFieldPending.bind(model.store),
    setTouched: model.store.setFieldTouched.bind(model.store),
    isTouched: model.store.isFieldTouched.bind(model.store),
    getErrors: model.validation.getFieldErrors.bind(model.validation),
    setErrors: model.validation.setFieldErrors.bind(model.validation),
    clearErrors,
    reset,
    validateField,
    validate,
  }
}

/**
 * 创建 Form 对外暴露的完整实例门面。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model、服务 binding 和两个 Registry 实例。
 * @returns 稳定的 Form 实例对象。
 *
 * @remarks
 * Runtime 断开后，读操作返回安全的空值，写操作不再触发已销毁的 Runtime。
 */
export function createFormFacade<TValues extends Values>(options: {
  model: FormModel<TValues>
  bindings: FormBindings<TValues>
  rendererRegistry: RendererRegistry
  validationRuleRegistry: ValidationRuleRegistry
}): SchemxInstance<TValues> {
  // FormFacade 只组装公开方法，不持有 Runtime 的内部实现细节。
  const { model, bindings, rendererRegistry, validationRuleRegistry } = options

  /**
   * 读取 Controller 的提交状态；断开后表单不再处于提交中。
   */
  const isLoading: SchemxInstance<TValues>["isLoading"] = () =>
    bindings.getConnectedController()?.isLoading() ?? false

  /**
   * 将字段校验委托给已连接的 Controller。
   */
  const validateField: SchemxInstance<TValues>["validateField"] = (name) =>
    bindings.getController().validateField(name)

  /**
   * 将整个表单校验委托给已连接的 Controller。
   */
  const validate: SchemxInstance<TValues>["validate"] = () =>
    bindings.getController().validate()

  // 绑定多个字段错误写入方法，并转换公开错误字段名。
  const setFieldsErrors: SchemxInstance<TValues>["setFieldsErrors"] = (fields) => {
    model.validation.setFieldsErrors(
      fields.map(({ name, errors }) => ({ name, messages: errors }))
    )
  }

  /**
   * 通过已连接的 Controller 重置整表；断开后仅恢复本地状态。
   */
  const reset: SchemxInstance<TValues>["reset"] = () =>
    bindings.getConnectedController()?.reset() ?? model.reset()

  /**
   * 通过已连接的 Controller 提交；断开后回退为本地校验。
   */
  const submit: SchemxInstance<TValues>["submit"] = () =>
    bindings.getConnectedController()?.submit() ??
    model.validation.validate(model.store.getFieldsValue())

  /**
   * Controller 连接期间，将字段规则同步委托给 Controller。
   */
  const setFieldRules: SchemxInstance<TValues>["setFieldRules"] = (path, rules) =>
    bindings.getConnectedController()?.setFieldRules(path, rules)

  // 委托批量设置字段规则；Controller 断开后操作失效。
  const setFieldsRules: SchemxInstance<TValues>["setFieldsRules"] = (fields) =>
    bindings.getConnectedController()?.setFieldsRules(fields)

  // 委托移除字段规则；Controller 断开后操作失效。
  const removeFieldRules: SchemxInstance<TValues>["removeFieldRules"] = (path) =>
    bindings.getConnectedController()?.removeFieldRules(path)

  // 委托批量移除字段规则；Controller 断开后操作失效。
  const removeFieldsRules: SchemxInstance<TValues>["removeFieldsRules"] = (names) =>
    bindings.getConnectedController()?.removeFieldsRules(names)

  // 委托替换根 Schema；Runtime 断开后操作失效。
  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) =>
    bindings.getConnectedRuntime()?.setSchemas(schemas)

  // 委托基于当前 Schema 更新下一版 Schema。
  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) =>
    bindings.getConnectedRuntime()?.updateSchemas(updater)

  // 委托更新指定字段的 Schema。
  const updateFieldSchema: SchemxInstance<TValues>["updateFieldSchema"] = (name, patch) =>
    bindings.getConnectedRuntime()?.updateFieldSchema(name, patch)

  // 委托更新表单级 Schema 默认配置。
  const updateSchemaConfig: SchemxInstance<TValues>["updateSchemaConfig"] = (partial) =>
    bindings.getConnectedRuntime()?.updateSchemaConfig(partial)

  // 读取当前已解析的视图 Schema；Runtime 断开后返回空数组。
  const getViewSchemas: SchemxInstance<TValues>["getViewSchemas"] = () =>
    bindings.getConnectedRuntime()?.getViewSchemas() ?? []

  // 订阅视图 Schema 变化；Runtime 断开后返回空清理函数。
  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => bindings.getConnectedRuntime()?.subscribeViewSchemas(callback) ?? (() => {})

  // 等待 Runtime 内部依赖调度完成；Runtime 断开后视为已完成。
  const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (timeout) =>
    bindings.getConnectedRuntime()?.waitForIdle(timeout) ?? Promise.resolve(true)

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
    resetField: model.store.resetField.bind(model.store),
    resetFields: model.store.resetFields.bind(model.store),
    isLoading,
    validateField,
    validate,
    getFieldErrors: model.validation.getFieldErrors.bind(model.validation),
    getFieldsErrors: model.validation.getFieldsErrors.bind(model.validation),
    setFieldErrors: model.validation.setFieldErrors.bind(model.validation),
    setFieldsErrors,
    clearFieldErrors: model.validation.clearFieldErrors.bind(model.validation),
    clearFieldsErrors: model.validation.clearFieldsErrors.bind(model.validation),
    clearErrors: model.validation.clearErrors.bind(model.validation),
    reset,
    submit,
    setFieldRules,
    setFieldsRules,
    removeFieldRules,
    removeFieldsRules,
    effect: model.effect,
    batch: model.batch,
    setSchemas,
    updateSchemas,
    updateFieldSchema,
    updateSchemaConfig,
    getViewSchemas,
    subscribeViewSchemas,
    waitForDependencies,
    getRenderer: rendererRegistry.resolve.bind(rendererRegistry),
    registerRenderer: rendererRegistry.register.bind(rendererRegistry),
    hasRenderer: rendererRegistry.has.bind(rendererRegistry),
    getRule: validationRuleRegistry.get.bind(
      validationRuleRegistry
    ) as SchemxInstance<TValues>["getRule"],
    registerRule: validationRuleRegistry.register.bind(
      validationRuleRegistry
    ) as SchemxInstance<TValues>["registerRule"],
    hasRule: validationRuleRegistry.has.bind(validationRuleRegistry),
    destroy: bindings.destroy,
  }
}
