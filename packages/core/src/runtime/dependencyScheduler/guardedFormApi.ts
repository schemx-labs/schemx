/**
 * Dependency Scheduler 的 Form API 适配。
 *
 * @module core/runtime/dependencyScheduler/guardedFormApi
 */

import type { SchemxFormApi, Values } from "../../types"

const mutatingMethods = new Set<PropertyKey>([
  "setFieldValue",
  "setFieldsValue",
  "setInitialValue",
  "setInitialValues",
  "setFieldTouched",
  "setFieldsTouched",
  "setFieldPending",
  "setFieldsPending",
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
])

/**
 * 为一次依赖任务创建带生命周期保护的 Form API。
 *
 * 任务取消后，代理的写入方法会忽略调用；读取方法仍委托给原始 Form API。
 *
 * @typeParam TValues - 表单值类型。
 * @param formApi - 当前运行时使用的 Form API。
 * @param signal - 任务取消信号。
 * @returns 绑定取消信号的 Form API。
 *
 * @example
 * ```ts
 * const controller = new AbortController()
 * const guardedApi = createGuardedFormApi(formApi, controller.signal)
 * controller.abort()
 * guardedApi.setFieldValue("email", "ignored after abort")
 * ```
 */
export function createGuardedFormApi<TValues extends Values>(
  formApi: SchemxFormApi<TValues>,
  signal: AbortSignal
): SchemxFormApi<TValues> {
  return new Proxy(formApi as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)

      if (typeof value !== "function") return value

      if (mutatingMethods.has(property)) {
        return (...args: unknown[]) => {
          if (signal.aborted) return undefined

          return Reflect.apply(value, target, args)
        }
      }

      return (...args: unknown[]) => Reflect.apply(value, target, args)
    },
  }) as SchemxFormApi<TValues>
}
