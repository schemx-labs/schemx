import type { FormBindings } from "./bindings"
import type { FormModel } from "./model"
import type { RendererRegistry, ValidationRuleRegistry } from "../registry"
import type { SchemxFormApi, SchemxInstance, Values } from "../types"

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
  // API 只保留 renderer 需要的字段状态与校验操作。
  // Store bindings exposed to renderers for reading and writing field values.
  const setValue = model.store.setFieldValue.bind(model.store)

  const setValues = model.store.setFieldsValue.bind(model.store)

  const getValue = model.store.getFieldValue.bind(model.store)

  const getValues = model.store.getFieldsValue.bind(model.store)

  // Snapshot binding used by renderers that need a consistent value view.
  const getSnapshots = model.store.getFieldsSnapshot.bind(model.store)

  // Interaction-state bindings exposed to asynchronous renderers.
  const setPending = model.store.setFieldPending.bind(model.store)

  const isPending = model.store.isFieldPending.bind(model.store)

  const setTouched = model.store.setFieldTouched.bind(model.store)

  const isTouched = model.store.isFieldTouched.bind(model.store)

  // Validation-error bindings exposed to renderer implementations.
  const getErrors = model.validator.getFieldErrors.bind(model.validator)

  const setErrors = model.validator.setFieldErrors.bind(model.validator)

  const clearErrors = model.validator.clearFieldErrors.bind(model.validator)

  // Reset binding for renderer-driven field restoration.
  const resetFields = model.store.resetFields.bind(model.store)

  /**
   * Validates a field through the connected Controller or local Validator fallback.
   */
  const validateField: SchemxFormApi<TValues>["validateField"] = (name) =>
    bindings.getConnectedController()?.validateField(name) ??
    model.validator.validateField(name, model.store.getFieldsValue())

  /**
   * Validates the form through the connected Controller or local Validator fallback.
   */
  const validate: SchemxFormApi<TValues>["validate"] = () =>
    bindings.getConnectedController()?.validate() ??
    model.validator.validate(model.store.getFieldsValue())

  return {
    setValue,
    setValues,
    getValue,
    getValues,
    getSnapshots,
    setPending,
    isPending,
    setTouched,
    isTouched,
    getErrors,
    setErrors,
    clearErrors,
    resetFields,
    reset: model.reset,
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

  // Store bindings exposed by the stable public Form instance.
  const setFieldValue = model.store.setFieldValue.bind(model.store)

  const setFieldsValue = model.store.setFieldsValue.bind(model.store)

  const getFieldValue = model.store.getFieldValue.bind(model.store)

  const getFieldsValue = model.store.getFieldsValue.bind(model.store)

  // Snapshot bindings for current and initial field state.
  const getFieldSnapshot = model.store.getFieldSnapshot.bind(model.store)

  const getFieldsSnapshot = model.store.getFieldsSnapshot.bind(model.store)

  const getInitialValue = model.store.getInitialValue.bind(model.store)

  const getInitialValues = model.store.getInitialValues.bind(model.store)

  const setInitialValues = model.store.setInitialValues.bind(model.store)

  // Interaction-state bindings for touched and pending fields.
  const isFieldTouched = model.store.isFieldTouched.bind(model.store)

  const setFieldTouched = model.store.setFieldTouched.bind(model.store)

  const getTouchedFields = model.store.getTouchedFields.bind(model.store)

  const setFieldPending = model.store.setFieldPending.bind(model.store)

  const isFieldPending = model.store.isFieldPending.bind(model.store)

  const getPendingFields = model.store.getPendingFields.bind(model.store)

  /**
   * Delegates field validation to the required connected Controller.
   */
  const validateField: SchemxInstance<TValues>["validateField"] = (name) =>
    bindings.getController().validateField(name)

  /**
   * Delegates full-form validation to the required connected Controller.
   */
  const validate: SchemxInstance<TValues>["validate"] = () =>
    bindings.getController().validate()

  // Validation-error bindings exposed by the stable Form instance.
  const getFieldErrors = model.validator.getFieldErrors.bind(model.validator)

  const setFieldErrors = model.validator.setFieldErrors.bind(model.validator)

  const clearFieldErrors = model.validator.clearFieldErrors.bind(model.validator)

  const resetFields = model.store.resetFields.bind(model.store)

  /**
   * Submits through the connected Controller or validates locally after disconnection.
   */
  const submit: SchemxInstance<TValues>["submit"] = () =>
    bindings.getConnectedController()?.submit() ??
    model.validator.validate(model.store.getFieldsValue())

  /**
   * Delegates rule synchronization when a Controller remains connected.
   */
  const setFieldRules: SchemxInstance<TValues>["setFieldRules"] = (path, rules) =>
    bindings.getConnectedController()?.setFieldRules(path, rules)

  const removeFieldRules: SchemxInstance<TValues>["removeFieldRules"] = (path) =>
    bindings.getConnectedController()?.removeFieldRules(path)

  // Runtime bindings that become inert after the Runtime disconnects.
  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) =>
    bindings.getConnectedRuntime()?.setSchemas(schemas)

  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) =>
    bindings.getConnectedRuntime()?.updateSchemas(updater)

  const updateFieldSchema: SchemxInstance<TValues>["updateFieldSchema"] = (name, patch) =>
    bindings.getConnectedRuntime()?.updateFieldSchema(name, patch)

  const updateDefaultProps: SchemxInstance<TValues>["updateDefaultProps"] = (partial) =>
    bindings.getConnectedRuntime()?.updateDefaultProps(partial)

  const getViewSchemas: SchemxInstance<TValues>["getViewSchemas"] = () =>
    bindings.getConnectedRuntime()?.getViewSchemas() ?? []

  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => bindings.getConnectedRuntime()?.subscribeViewSchemas(callback) ?? (() => {})

  const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (timeout) =>
    bindings.getConnectedRuntime()?.waitForIdle(timeout) ?? Promise.resolve(true)

  // Renderer Registry bindings retained by the stable public instance.
  const getRenderer = rendererRegistry.resolve.bind(rendererRegistry)

  const registerRenderer = rendererRegistry.register.bind(rendererRegistry)

  const hasRenderer = rendererRegistry.has.bind(rendererRegistry)

  // Validation Rule Registry bindings retained by the stable public instance.
  const getRule = validationRuleRegistry.get.bind(
    validationRuleRegistry
  ) as SchemxInstance<TValues>["getRule"]

  const registerRule = validationRuleRegistry.register.bind(
    validationRuleRegistry
  ) as SchemxInstance<TValues>["registerRule"]

  const hasRule = validationRuleRegistry.has.bind(validationRuleRegistry)

  return {
    setFieldValue,
    setFieldsValue,
    getFieldValue,
    getFieldsValue,
    getFieldSnapshot,
    getFieldsSnapshot,
    getInitialValue,
    getInitialValues,
    setInitialValues,
    isFieldTouched,
    setFieldTouched,
    getTouchedFields,
    setFieldPending,
    isFieldPending,
    getPendingFields,
    validateField,
    validate,
    getFieldErrors,
    setFieldErrors,
    clearFieldErrors,
    resetFields,
    reset: model.reset,
    submit,
    setFieldRules,
    removeFieldRules,
    effect: model.effect,
    batch: model.batch,
    setSchemas,
    updateSchemas,
    updateFieldSchema,
    updateDefaultProps,
    getViewSchemas,
    subscribeViewSchemas,
    waitForDependencies,
    getRenderer,
    registerRenderer,
    hasRenderer,
    getRule,
    registerRule,
    hasRule,
    destroy: bindings.destroy,
  }
}
