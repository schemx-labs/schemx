import { pick } from "es-toolkit"

import type { SchemxFormApi, SchemxInstance, Values } from "../types"

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
  return pick(instance, [
    "setFieldValue",
    "setFieldsValue",
    "getFieldValue",
    "getFieldsValue",
    "getFieldSnapshot",
    "getFieldsSnapshot",
    "getInitialValue",
    "getInitialValues",
    "setInitialValue",
    "setInitialValues",
    "isFieldTouched",
    "isFieldsTouched",
    "setFieldTouched",
    "setFieldsTouched",
    "getTouchedFields",
    "setFieldPending",
    "setFieldsPending",
    "isFieldPending",
    "isFieldsPending",
    "getPendingFields",
    "isLoading",
    "getFieldErrors",
    "getFieldsErrors",
    "setFieldErrors",
    "setFieldsErrors",
    "clearFieldErrors",
    "clearFieldsErrors",
    "clearErrors",
    "setFieldRules",
    "setFieldsRules",
    "removeFieldRules",
    "removeFieldsRules",
    "resetField",
    "resetFields",
    "reset",
    "validateField",
    "validate",
  ])
}
