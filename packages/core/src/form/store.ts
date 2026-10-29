import type { Store } from "../store"
import type { SchemxFormApi, Values } from "../types"
import type { ValidationRuleIssue } from "../validator"

/**
 * Store 域允许公开的读写、错误和重置操作。
 * @typeParam TValues - 表单值类型。
 */
export type FormStoreApi<TValues extends Values> = Pick<
  SchemxFormApi<TValues>,
  | "setFieldValue"
  | "setFieldsValue"
  | "getFieldValue"
  | "getFieldsValue"
  | "getFieldSnapshot"
  | "getFieldsSnapshot"
  | "getInitialValue"
  | "getInitialValues"
  | "setInitialValue"
  | "setInitialValues"
  | "isFieldTouched"
  | "isFieldsTouched"
  | "setFieldTouched"
  | "setFieldsTouched"
  | "getTouchedFields"
  | "setFieldPending"
  | "setFieldsPending"
  | "isFieldPending"
  | "isFieldsPending"
  | "getPendingFields"
  | "clearFieldErrors"
  | "clearFieldsErrors"
  | "resetField"
  | "resetFields"
  | "getFieldErrors"
  | "getFieldsErrors"
  | "setFieldErrors"
  | "setFieldsErrors"
  | "clearErrors"
  | "reset"
>

/**
 * Store 域依赖及完整重置通知。
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFormStoreOptions<TValues extends Values> {
  /**
   * 所属 Form 拥有的路径状态。
   */
  readonly store: Store<TValues>
  /**
   * 完整重置并清理错误后调用。
   */
  readonly onReset?: () => void
}

/**
 * Store 的消费端投影，不拥有底层资源。
 * @typeParam TValues - 表单值类型。
 */
export interface FormStore<TValues extends Values> {
  /**
   * 绑定到原始 Store 的公开操作。
   */
  readonly api: FormStoreApi<TValues>
}

/**
 * 把公开消息转换成标记为 external 的原生问题。
 * @param messages - 消费端提供的错误消息。
 */
function toExternalIssues(messages: readonly string[]): readonly ValidationRuleIssue[] {
  // message 是消费端提供的一条错误提示。
  return messages.map((message) => ({ type: "external", message, code: "external" }))
}

/**
 * 适配公开错误协议及完整重置流程。
 * @typeParam TValues - 表单值类型。
 * @param options - 原始 Store 与重置通知。
 * @example const domain = createFormStore({ store, onReset })
 */
export function createFormStore<TValues extends Values>(
  options: CreateFormStoreOptions<TValues>
): FormStore<TValues> {
  // 原始 Store 由Form 持有，域只生成消费端方法。
  const { store, onReset } = options

  /**
   * 完整重置时清理全部错误并通知业务回调。
   * @example formApi.reset()
   */
  const reset: SchemxFormApi<TValues>["reset"] = () => {
    store.reset()
    store.clearAllErrors()
    onReset?.()
  }

  /**
   * 从结构化问题中读取公开消息。
   * @param name - 当前字段路径。
   * @example const errors = formApi.getFieldErrors("email")
   */
  const getFieldErrors: SchemxFormApi<TValues>["getFieldErrors"] = (name) =>
    // issue 是保留来源的原生问题。
    store.getFieldErrors(name).map((issue) => issue.message)

  /**
   * 转换多个字段的公开错误消息。
   * @param names - 要读取的字段路径；省略时读取全部错误。
   * @example const errors = formApi.getFieldsErrors()
   */
  const getFieldsErrors: SchemxFormApi<TValues>["getFieldsErrors"] = (names) =>
    // field/errors 是原生字段地址与问题，issue 只投影消息。
    store.getFieldsErrors(names).map(({ field, errors }) => ({
      name: field,
      errors: errors.map((issue) => issue.message),
    }))

  /**
   * 写入单字段公开错误消息。
   * @param name - 当前字段路径。
   * @param errors - 消费端错误消息。
   * @example formApi.setFieldErrors("email", ["格式错误"])
   */
  const setFieldErrors: SchemxFormApi<TValues>["setFieldErrors"] = (name, errors) => {
    store.setFieldErrors(name, toExternalIssues(errors))
  }

  /**
   * 写入多字段公开错误消息。
   * @param fields - 字段路径与公开消息列表。
   * @example formApi.setFieldsErrors([{ name: "email", errors: ["格式错误"] }])
   */
  const setFieldsErrors: SchemxFormApi<TValues>["setFieldsErrors"] = (fields) => {
    // name/errors 是公开协议中的字段地址与消息。
    store.setFieldsErrors(
      fields.map(({ name, errors }) => ({
        field: name,
        errors: toExternalIssues(errors),
      }))
    )
  }

  // 逐项绑定接收者，避免公开原始资源的内部方法。
  const api: FormStoreApi<TValues> = {
    setFieldValue: store.setFieldValue.bind(store),
    setFieldsValue: store.setFieldsValue.bind(store),
    getFieldValue: store.getFieldValue.bind(store),
    getFieldsValue: store.getFieldsValue.bind(store),
    getFieldSnapshot: store.getFieldSnapshot.bind(store),
    getFieldsSnapshot: store.getFieldsSnapshot.bind(store),
    getInitialValue: store.getInitialValue.bind(store),
    getInitialValues: store.getInitialValues.bind(store),
    setInitialValue: store.setInitialValue.bind(store),
    setInitialValues: store.setInitialValues.bind(store),
    isFieldTouched: store.isFieldTouched.bind(store),
    isFieldsTouched: store.isFieldsTouched.bind(store),
    setFieldTouched: store.setFieldTouched.bind(store),
    setFieldsTouched: store.setFieldsTouched.bind(store),
    getTouchedFields: store.getTouchedFields.bind(store),
    setFieldPending: store.setFieldPending.bind(store),
    setFieldsPending: store.setFieldsPending.bind(store),
    isFieldPending: store.isFieldPending.bind(store),
    isFieldsPending: store.isFieldsPending.bind(store),
    getPendingFields: store.getPendingFields.bind(store),
    clearFieldErrors: store.clearFieldErrors.bind(store),
    clearFieldsErrors: store.clearFieldsErrors.bind(store),
    resetField: store.resetField.bind(store),
    resetFields: store.resetFields.bind(store),
    getFieldErrors,
    getFieldsErrors,
    setFieldErrors,
    setFieldsErrors,
    clearErrors: store.clearAllErrors.bind(store),
    reset,
  }

  return { api }
}
