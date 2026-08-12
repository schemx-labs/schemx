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
  // 仅向动态 renderer 暴露字段状态读写与校验所需的最小 API。
  // 绑定字段值写入方法，保持调用时的 Store 上下文。
  const setValue = model.store.setFieldValue.bind(model.store)

  // 绑定批量字段值写入方法。
  const setValues = model.store.setFieldsValue.bind(model.store)

  // 绑定单字段值读取方法。
  const getValue = model.store.getFieldValue.bind(model.store)

  // 绑定全部字段值读取方法。
  const getValues = model.store.getFieldsValue.bind(model.store)

  // 绑定字段快照读取方法，为 renderer 提供一致的值视图。
  const getSnapshots = model.store.getFieldsSnapshot.bind(model.store)

  // 绑定字段 pending 状态写入方法。
  const setPending = model.store.setFieldPending.bind(model.store)

  // 绑定字段 pending 状态读取方法。
  const isPending = model.store.isFieldPending.bind(model.store)

  // 绑定字段 touched 状态写入方法。
  const setTouched = model.store.setFieldTouched.bind(model.store)

  // 绑定字段 touched 状态读取方法。
  const isTouched = model.store.isFieldTouched.bind(model.store)

  // 绑定字段错误读取方法。
  const getErrors = model.validator.getFieldErrors.bind(model.validator)

  // 绑定字段错误写入方法。
  const setErrors = model.validator.setFieldErrors.bind(model.validator)

  // 绑定字段错误清理方法。
  const clearErrors = model.validator.clearFieldErrors.bind(model.validator)

  // 绑定字段重置方法，支持 renderer 恢复字段状态。
  const resetFields = model.store.resetFields.bind(model.store)

  /**
   * 通过已连接的 Controller 校验字段；未连接时回退到本地 Validator。
   */
  const validateField: SchemxFormApi<TValues>["validateField"] = (name) =>
    bindings.getConnectedController()?.validateField(name) ??
    model.validator.validateField(name, model.store.getFieldsValue())

  /**
   * 通过已连接的 Controller 校验整个表单；未连接时回退到本地 Validator。
   */
  const validate: SchemxFormApi<TValues>["validate"] = () =>
    bindings.getConnectedController()?.validate() ??
    model.validator.validate(model.store.getFieldsValue())

  /**
   * 通过已连接的 Controller 重置整表，确保生命周期回调一致。
   */
  const reset: SchemxFormApi<TValues>["reset"] = () =>
    bindings.getConnectedController()?.reset() ?? model.reset()

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

  // 绑定单字段值写入方法。
  const setFieldValue = model.store.setFieldValue.bind(model.store)

  // 绑定批量字段值写入方法。
  const setFieldsValue = model.store.setFieldsValue.bind(model.store)

  // 绑定单字段值读取方法。
  const getFieldValue = model.store.getFieldValue.bind(model.store)

  // 绑定全部字段值读取方法。
  const getFieldsValue = model.store.getFieldsValue.bind(model.store)

  // 绑定单字段当前快照读取方法。
  const getFieldSnapshot = model.store.getFieldSnapshot.bind(model.store)

  // 绑定全部字段当前快照读取方法。
  const getFieldsSnapshot = model.store.getFieldsSnapshot.bind(model.store)

  // 绑定单字段初始值读取方法。
  const getInitialValue = model.store.getInitialValue.bind(model.store)

  // 绑定全部字段初始值读取方法。
  const getInitialValues = model.store.getInitialValues.bind(model.store)

  // 绑定初始值更新方法。
  const setInitialValues = model.store.setInitialValues.bind(model.store)

  // 绑定字段 touched 状态读取方法。
  const isFieldTouched = model.store.isFieldTouched.bind(model.store)

  // 绑定字段 touched 状态写入方法。
  const setFieldTouched = model.store.setFieldTouched.bind(model.store)

  // 绑定已 touched 字段列表读取方法。
  const getTouchedFields = model.store.getTouchedFields.bind(model.store)

  // 绑定字段 pending 状态写入方法。
  const setFieldPending = model.store.setFieldPending.bind(model.store)

  // 绑定字段 pending 状态读取方法。
  const isFieldPending = model.store.isFieldPending.bind(model.store)

  // 绑定 pending 字段列表读取方法。
  const getPendingFields = model.store.getPendingFields.bind(model.store)

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

  // 绑定字段错误读取方法。
  const getFieldErrors = model.validator.getFieldErrors.bind(model.validator)

  // 绑定字段错误写入方法。
  const setFieldErrors = model.validator.setFieldErrors.bind(model.validator)

  // 绑定字段错误清理方法。
  const clearFieldErrors = model.validator.clearFieldErrors.bind(model.validator)

  // 绑定字段重置方法。
  const resetFields = model.store.resetFields.bind(model.store)

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
    model.validator.validate(model.store.getFieldsValue())

  /**
   * Controller 连接期间，将字段规则同步委托给 Controller。
   */
  const setFieldRules: SchemxInstance<TValues>["setFieldRules"] = (path, rules) =>
    bindings.getConnectedController()?.setFieldRules(path, rules)

  // 委托移除字段规则；Controller 断开后操作失效。
  const removeFieldRules: SchemxInstance<TValues>["removeFieldRules"] = (path) =>
    bindings.getConnectedController()?.removeFieldRules(path)

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

  // 绑定 Renderer Registry 的渲染器解析方法。
  const getRenderer = rendererRegistry.resolve.bind(rendererRegistry)

  // 绑定 Renderer Registry 的渲染器注册方法。
  const registerRenderer = rendererRegistry.register.bind(rendererRegistry)

  // 绑定 Renderer Registry 的渲染器存在性检查方法。
  const hasRenderer = rendererRegistry.has.bind(rendererRegistry)

  // 绑定 Validation Rule Registry 的规则读取方法，并适配公开接口类型。
  const getRule = validationRuleRegistry.get.bind(
    validationRuleRegistry
  ) as SchemxInstance<TValues>["getRule"]

  // 绑定 Validation Rule Registry 的规则注册方法，并适配公开接口类型。
  const registerRule = validationRuleRegistry.register.bind(
    validationRuleRegistry
  ) as SchemxInstance<TValues>["registerRule"]

  // 绑定 Validation Rule Registry 的规则存在性检查方法。
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
    isLoading,
    validateField,
    validate,
    getFieldErrors,
    setFieldErrors,
    clearFieldErrors,
    resetFields,
    reset,
    submit,
    setFieldRules,
    removeFieldRules,
    effect: model.effect,
    batch: model.batch,
    setSchemas,
    updateSchemas,
    updateFieldSchema,
    updateSchemaConfig,
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
