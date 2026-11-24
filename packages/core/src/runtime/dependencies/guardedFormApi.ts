/**
 * Dependency Scheduler 的 Form API 适配。
 *
 * @module core/runtime/dependencies/guardedFormApi
 */

import {
  createValidationCancelled,
  createValidationFailure,
} from "../../validator/result"

import type { SchemxFormApi, Values } from "../../types"

/** 任务取消后需要拦截的表单写入方法。 */
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

/** 一次依赖任务独占的 API 与完成通知。 */
interface GuardedFormApi<TValues extends Values> {
  /** 传给依赖回调的 API。 */
  readonly api: SchemxFormApi<TValues>
  /** 正常结束时解除校验限制。 */
  readonly finish: () => void
}

/**
 * 为一次依赖任务创建带生命周期保护的 Form API。
 *
 * 任务执行期间拒绝等待自身的校验。任务取消后忽略写入，校验返回取消结果。
 *
 * @typeParam TValues - 表单值类型。
 * @param formApi - 当前运行时使用的 Form API。
 * @param signal - 任务取消信号。
 * @returns 绑定本次任务的 API 及完成通知。
 *
 * @example
 * ```ts
 * const controller = new AbortController()
 * const guarded = createGuardedFormApi(formApi, controller.signal)
 * guarded.finish()
 * controller.abort()
 * guarded.api.setFieldValue("email", "ignored after abort")
 * ```
 */
export function createGuardedFormApi<TValues extends Values>(
  formApi: SchemxFormApi<TValues>,
  signal: AbortSignal
): GuardedFormApi<TValues> {
  // 只限制本次任务持有的 API，表单的其他调用方可以正常等待调度。
  let active = true

  /** 标记本次回调已结束。 */
  const finish = (): void => {
    active = false
  }

  // 保留现有公开签名，在方法调用时检查任务状态。
  const api = new Proxy(formApi, {
    // target 是原始 API，property 是当前读取的方法，receiver 用于属性访问。
    get(target, property, receiver) {
      // 当前属性的原始实现。
      const value = Reflect.get(target, property, receiver)

      if (typeof value !== "function") return value

      if (property === "validate" || property === "validateField") {
        // args 为校验调用的原始参数，任务正常结束后原样转发。
        return (...args: unknown[]) => {
          if (signal.aborted) {
            return Promise.resolve(createValidationCancelled(formApi.getFieldsSnapshot()))
          }

          if (active) {
            return Promise.resolve(
              createValidationFailure(formApi.getFieldsSnapshot(), [
                {
                  scope: "form",
                  issues: [
                    {
                      type: "configuration",
                      code: "dependency_validation_reentry",
                      message: "依赖计算期间无法执行表单校验，请在依赖完成后校验",
                    },
                  ],
                },
              ])
            )
          }

          return Reflect.apply(value, target, args)
        }
      }

      if (mutatingMethods.has(property)) {
        // args 为写入调用的原始参数。
        return (...args: unknown[]) => {
          if (signal.aborted) return undefined

          return Reflect.apply(value, target, args)
        }
      }

      // args 为只读调用的原始参数。
      return (...args: unknown[]) => Reflect.apply(value, target, args)
    },
  })

  return { api, finish }
}
