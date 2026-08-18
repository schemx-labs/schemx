import { createSignal } from "../reactivity"
import { withLock } from "../utils"

import type { FormModel } from "./model"
import type { SchemaRuntime } from "../runtime/createSchemaRuntime"
import type { NamePath, Values } from "../types"
import type { FieldRules } from "../types/rule"
import type {
  ValidationFailure,
  ValidationFieldConfig,
  ValidationResult,
} from "../validator"

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
 * 负责等待 Runtime 依赖、执行校验和触发提交回调的 Form 控制器。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormController<TValues extends Values> {
  /**
   * 校验指定字段。
   */
  validateField<TName extends NamePath<TValues>>(
    name: TName
  ): Promise<ValidationResult<TValues, TName>>
  /**
   * 等待依赖解析后校验整个表单。
   */
  validate(): Promise<ValidationResult<TValues>>
  /**
   * 校验并按结果触发提交成功或失败回调。
   */
  submit(): Promise<ValidationResult<TValues>>
  /**
   * 重置整个表单并触发重置回调。
   */
  reset(): void
  /**
   * 返回当前提交流程是否仍在进行中。
   */
  isLoading(): boolean
  /**
   * 设置字段校验规则覆盖。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    path: TName,
    rules: FieldRules<TValues, TName>
  ): void
  /**
   * 批量设置字段校验规则覆盖。
   */
  setFieldsRules<TName extends NamePath<TValues>>(
    fields: readonly {
      readonly name: TName
      readonly rules: FieldRules<TValues, TName>
    }[]
  ): void
  /**
   * 移除字段校验规则覆盖。
   */
  removeFieldRules<TName extends NamePath<TValues>>(path: TName): void
  /**
   * 批量移除字段校验规则覆盖。
   */
  removeFieldsRules(names: readonly NamePath<TValues>[]): void
}

/**
 * 创建一个与 FormModel 和 SchemaRuntime 协作的控制器。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 控制器依赖的 Model、Runtime 和提交回调。
 * @returns 可供 FormInstance 调用的控制器。
 */
export function createFormController<TValues extends Values>(options: {
  model: FormModel<TValues>
  runtime: SchemaRuntime<TValues>
  callbacks: FormCallbacks<TValues>
}): FormController<TValues> {
  // 控制器直接委托状态与校验给 Model，并使用 Runtime 等待依赖状态。
  const { model, runtime, callbacks } = options

  // 提交流程状态必须独立于字段 pending，以便 UI 区分表单提交与字段异步操作。
  const loading = createSignal(false)

  /**
   * 同步提交 loading 并通知创建期回调。
   */
  const setLoading = (nextLoading: boolean): void => {
    loading.value = nextLoading
    callbacks.onLoadingChange?.(nextLoading)
  }

  /**
   * 返回当前提交 loading，并允许 Form effect 追踪该状态。
   */
  const isLoading: FormController<TValues>["isLoading"] = () => loading.value

  /**
   * 完成整表重置后再触发回调，保证回调能读取最终状态。
   */
  const reset: FormController<TValues>["reset"] = () => {
    model.reset()
    callbacks.onReset?.()
  }

  /**
   * 校验单个字段，并确保字段依赖已经完成解析。
   */
  const validateField: FormController<TValues>["validateField"] = async (name) => {
    await runtime.waitForCriticalIdle()

    return model.validation.validateField(name, model.store.getFieldsValue())
  }

  /**
   * 在 Runtime 已空闲时执行整表校验。
   */
  const validateAfterIdle = async (): Promise<ValidationResult<TValues>> => {
    // 当前仍处于异步操作中的字段。
    const pendingFields = model.store.getPendingFields()

    if (pendingFields.length > 0) {
      // 没有字段自定义消息时使用的统一提示。
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((item) => item.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        valid: false,
        values: model.store.getFieldsSnapshot(),
        errors: pendingFields.map(({ field, message }) => {
          // 优先使用字段自定义消息，否则返回统一的处理中提示。
          const messages = message.length ? message : ["字段正在处理中，请稍后重试"]

          model.validation.setFieldErrors(field as NamePath<TValues>, messages)

          return {
            scope: "field" as const,
            name: field as NamePath<TValues>,
            issues: messages.map((item) => ({ message: item, code: "pending" })) as [
              { message: string; code: string },
              ...{ message: string; code: string }[],
            ],
          }
        }),
      }
    }

    return model.validation.validate(model.store.getFieldsValue())
  }

  /**
   * 带并发锁的整表校验流程。
   */
  const validate = withLock(async (): Promise<ValidationResult<TValues>> => {
    // 依赖解析是否在超时前完成。
    const depsReady = await runtime.waitForCriticalIdle()

    if (!depsReady) {
      return createDependencyTimeoutResult(model.store.getFieldsSnapshot())
    }

    return validateAfterIdle()
  })

  /**
   * 带并发锁的提交流程，并负责触发提交回调。
   */
  const submit = withLock(async (): Promise<ValidationResult<TValues>> => {
    try {
      setLoading(true)

      // 提交前等待所有字段依赖稳定。
      const depsReady = await runtime.waitForCriticalIdle()

      if (!depsReady) {
        return createDependencyTimeoutResult(model.store.getFieldsSnapshot())
      }

      // 提交已经等待过 Runtime 空闲，直接执行校验，避免重复等待。
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

  /**
   * 将字段公开规则声明同步到校验状态。
   */
  const setFieldRules: FormController<TValues>["setFieldRules"] = (path, rules) => {
    const effective = runtime.getEffectiveFieldSchema(path)

    const config: ValidationFieldConfig<TValues, typeof path> = {
      name: path,
      label: effective?.label ?? "",
      required: (effective?.required ?? false) as ValidationFieldConfig<
        TValues,
        typeof path
      >["required"],
      rules,
    }

    model.validation.setFieldRules(config)
  }

  /**
   * 批量同步字段校验规则覆盖。
   */
  const setFieldsRules: FormController<TValues>["setFieldsRules"] = (fields) => {
    for (const field of fields) {
      setFieldRules(field.name, field.rules)
    }
  }

  /**
   * 移除字段校验配置及延迟同步任务。
   */
  const removeFieldRules: FormController<TValues>["removeFieldRules"] = (path) => {
    model.validation.removeFieldRules(path)
  }

  /**
   * 批量移除字段校验规则覆盖。
   */
  const removeFieldsRules: FormController<TValues>["removeFieldsRules"] = (names) => {
    for (const name of names) {
      removeFieldRules(name)
    }
  }

  return {
    validateField,
    validate,
    submit,
    reset,
    isLoading,
    setFieldRules,
    setFieldsRules,
    removeFieldRules,
    removeFieldsRules,
  }
}

/**
 * 创建依赖解析超时的表单级失败结果。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param values - 超时时刻的表单值快照。
 * @returns 描述依赖超时的失败结果。
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
        issues: [{ message: "表单依赖解析超时，请稍后重试", code: "dependency_timeout" }],
      },
    ],
  }
}
