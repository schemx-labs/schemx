/**
 * ValidationEffect - 校验规则注册 effect。
 *
 * ValidationEffect 只同步字段规则与 Validator 的注册状态，
 * 字段交互触发校验由具体渲染层调用字段校验命令。
 *
 * @module core/runtime/field/validationEffect
 */

import { createSignalEffect } from "../../reactivity"
import { createFieldKey } from "../../utils"

import type { FieldValidationSchema } from "./runtimeState"
import type { ComputedSignal } from "../../reactivity/computed"
import type { SchemxBaseField, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { Scope } from "../node"

/**
 * 创建 ValidationEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateValidationEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   *
   * 包含 ValidationController、调度器及字段生命周期所需的共享资源。
   */
  context: SchemaRuntimeContext<TValues>

  /**
   * 字段名路径。
   *
   * 该路径同时用于注册规则和安排 post 队列任务。
   */
  name: SchemxBaseField<TValues>["name"]

  /**
   * 字段有效状态 computed（Signal Graph 阶段）。
   *
   * 它的变化会重新计算字段是否应注册校验规则。
   */
  validationSchema: ComputedSignal<FieldValidationSchema<TValues>>

  /**
   * 关联的 scope。
   *
   * ValidationEffect 会取得该 Scope 的销毁权：调用 `effect.dispose()` 会销毁传入的整个 Scope。
   * 请传入仅由该 effect 所有的专用 Scope；Scope 销毁时会同步注销该字段的规则与错误。
   */
  scope: Scope
}

/**
 * 校验规则注册 effect。
 */
export interface ValidationEffect {
  /**
   * 销毁创建该 effect 时传入的整个 Scope，并注销字段校验规则。
   *
   * 该方法不是只释放 effect 自身；不要将 `effect.dispose` 注册为同一 Scope 的清理回调，
   * 也不要传入仍需要继续使用的表单或字段 Scope。
   */
  dispose(): void
}

/** 保存一次校验规则注册所需的字段配置快照。 */
interface ValidationRegistrationSnapshot<TValues extends Values = Values> {
  /** 字段是否可见。 */
  visible: boolean
  /** 字段是否只读。 */
  readonly: boolean
  /** 字段是否禁用。 */
  disabled: boolean
  /** 用于错误提示的字段标签。 */
  label: string
  /** 字段是否必填。 */
  required: SchemxBaseField<TValues>["required"]
  /** 字段当前规则列表。 */
  rules: SchemxBaseField<TValues>["rules"]
}

/**
 * 创建一个 ValidationEffect 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 配置选项
 * @returns 新创建的 ValidationEffect
 *
 * @example
 * ```ts
 * const effectScope = createScope()
 * const effect = createValidationEffect({ context, name, validationSchema, scope: effectScope })
 *
 * // 由专用 Scope 的拥有者在字段卸载时调用。
 * effect.dispose()
 * ```
 */
export function createValidationEffect<TValues extends Values = Values>(
  options: CreateValidationEffectOptions<TValues>
): ValidationEffect {
  const { context, name, validationSchema, scope } = options

  const taskScheduler = context.scheduler

  let registrationVersion = 0

  let lastScheduledSnapshot: ValidationRegistrationSnapshot<TValues> | undefined

  /**
   * 读取参与规则注册决策的响应式字段呈现态。
   *
   * 直接读取 validationSchema，避免订阅纯展示字段。
   */
  const readValidationProps = (): ValidationRegistrationSnapshot<TValues> => {
    const effective = validationSchema.value

    return {
      visible: effective.visible,
      readonly: effective.readonly,
      disabled: effective.disabled,
      label: effective.label,
      required: effective.required,
      rules: effective.rules,
    }
  }

  /**
   * 根据当前字段呈现态注册或注销校验规则。
   */
  const applyRegistration = (snapshot: ValidationRegistrationSnapshot<TValues>): void => {
    const { visible, readonly, disabled, label, required, rules } = snapshot

    if (!visible || readonly || disabled || (!required && !hasRules(rules))) {
      context.validation.removeSchemaField(name)

      return
    }

    context.validation.syncField({ name, label, required, rules })
  }

  /**
   * 将规则注册延后到 post 队列，避免与字段呈现态更新竞争。
   */
  const scheduleRegistration = (
    snapshot: ValidationRegistrationSnapshot<TValues>
  ): void => {
    if (lastScheduledSnapshot === snapshot) {
      return
    }

    lastScheduledSnapshot = snapshot

    const currentVersion = ++registrationVersion

    taskScheduler.schedule({
      id: `validation:${createFieldKey(name as never)}`,
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

  // 作用域释放时同步注销校验规则并清空错误
  scope.add(() => {
    registrationVersion += 1
    context.validation.removeField(name)

  })

  const disposeEffect = createSignalEffect(() => {
    scheduleRegistration(readValidationProps())
  })

  scope.add(disposeEffect)

  /**
   * 释放校验 effect 持有的资源作用域。
   */
  const dispose = (): void => {
    scope.dispose()
  }

  return {
    dispose,
  }
}

/**
 * 判断 rules 是否非空：数组时检查长度，非数组时做 truthy 判断。
 */
function hasRules<TValues extends Values>(
  rules: SchemxBaseField<TValues>["rules"]
): boolean {
  return Array.isArray(rules) ? rules.length > 0 : Boolean(rules)
}
