/**
 * ValidationEffect - 校验 effect。
 *
 * Validation 是字段状态的 effect，不是 lifecycle bridge。
 *
 * @module core/field/validationEffect
 */

import { createSignal, createSignalEffect } from "../reactivity"

import type { SchemxFormContext } from "../createForm"
import type { FieldModel } from "./model"
import type { Scope } from "../node"
import type { Signal } from "../reactivity"
import type { SchemxBaseField, Values } from "../types"
import type { ValidateResult } from "../validator"

/**
 * 校验模型。
 */
export interface ValidationModel<TValues extends Values> {
  /**
   * 是否已注册规则。
   */
  registered: Signal<boolean>

  /**
   * 是否正在校验。
   */
  validating: Signal<boolean>

  /**
   * 执行校验。
   *
   * @returns 字段校验结果。
   */
  validate(): Promise<ValidateResult<TValues>>

  /**
   * 释放资源。
   */
  dispose(): void
}

/**
 * 创建 ValidationEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateValidationEffectOptions<TValues extends Values = Values> {
  /**
   * 字段名路径。
   */
  name: SchemxBaseField<TValues>["name"]

  /**
   * 字段呈现态模型。
   */
  fieldModel: FieldModel<TValues>

  /**
   * 关联的 scope。
   */
  scope: Scope

  /**
   * 表单内部上下文。
   */
  context: SchemxFormContext<TValues>
}

interface ValidationRegistrationSnapshot {
  visible: boolean
  readonly: boolean
  disabled: boolean
  label: string
  rules: SchemxBaseField<Values>["rules"]
}

/**
 * 创建一个 ValidationEffect 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 配置选项
 * @returns 新创建的 ValidationModel
 */
export function createValidationEffect<TValues extends Values = Values>(
  options: CreateValidationEffectOptions<TValues>
): ValidationModel<TValues> {
  const { name, fieldModel, scope, context } = options

  const taskScheduler = context.scheduler

  const registered = createSignal(false)
  const validating = createSignal(false)
  let registrationVersion = 0

  /**
   * 读取参与规则注册决策的响应式字段呈现态。
   */
  const readValidationProps = (): ValidationRegistrationSnapshot => {
    const snapshot = fieldModel.snapshot.value

    return {
      visible: snapshot.visible,
      readonly: snapshot.readonly,
      disabled: snapshot.disabled,
      label: snapshot.label,
      rules: snapshot.rules,
    }
  }

  /**
   * 根据当前字段呈现态注册或注销校验规则。
   */
  const applyRegistration = (snapshot: ValidationRegistrationSnapshot): void => {
    const { visible, readonly, disabled, label, rules } = snapshot

    if (!visible || readonly || disabled || !rules) {
      context.instance.unregisterRules(name)
      context.instance.setFieldError(name, [])

      registered.value = false

      return
    }

    context.instance.registerRules(name, rules, `${label}为必填项`)

    registered.value = true
  }

  /**
   * 将规则注册延后到 post 队列，避免与字段呈现态更新竞争。
   */
  const scheduleRegistration = (snapshot: ValidationRegistrationSnapshot): void => {
    const currentVersion = ++registrationVersion

    taskScheduler.schedule({
      id: `validation:${String(name)}`,
      priority: "post",
      scope,
      run: () => {
        if (scope.disposed || currentVersion !== registrationVersion) {
          return
        }

        applyRegistration(snapshot)
      },
    })
  }

  scope.add(() => {
    registrationVersion += 1
    context.instance.unregisterRules(name)
    context.instance.setFieldError(name, [])

    registered.value = false
  })

  const disposeEffect = createSignalEffect(() => {
    scheduleRegistration(readValidationProps())
  })

  scope.add(disposeEffect)

  /**
   * 执行当前字段校验并维护 validating 状态。
   */
  const validate = async (): Promise<ValidateResult<TValues>> => {
    validating.value = true

    try {
      const result = await context.instance.validateField(name)

      return result as ValidateResult<TValues>
    } finally {
      validating.value = false
    }
  }

  /**
   * 释放校验 effect 持有的资源作用域。
   */
  const dispose = (): void => {
    scope.dispose()
  }

  return {
    registered,
    validating,
    validate,
    dispose,
  }
}
