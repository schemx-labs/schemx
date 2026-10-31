/**
 * ValidationEffect - 校验规则注册 effect。
 *
 * ValidationEffect 只同步字段规则与 Validator 的注册状态，
 * 字段交互触发校验由 Core 的 changeField/blurField 统一编排。
 *
 * @module core/field/validationEffect
 */

import { createSignalEffect } from "../reactivity"

import type { FieldValidationState, NodeId, Scope } from "../node"
import type { ComputedSignal } from "../reactivity"
import type { PresetRuleEntry, PresetRuleFactoryContext } from "../registry"
import type { FormRuntimeContext } from "../runtimeContext"
import type { FieldRules, NamePath, SchemxBaseField, Values } from "../types"

/**
 * 创建 ValidationEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateValidationEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   *
   * 包含 Validator、调度器及字段生命周期所需的共享资源。
   */
  context: FormRuntimeContext<TValues>

  /**
   * 标识 post 队列任务的稳定节点 ID；规则注册使用下方的数据路径。
   */
  nodeId: NodeId
  /**
   * 本次 effect 绑定的数据路径；改名时释放旧 effect 并重新创建。
   */
  name: SchemxBaseField<TValues>["name"]
  /**
   * 读取当前字段路径对应的表单级兜底规则。
   */
  fallbackRules?: () => SchemxBaseField<TValues>["rules"] | PresetRuleEntry<unknown>

  /**
   * 字段有效状态 computed（Signal Graph 阶段）。
   *
   * 它的变化会重新计算字段是否应注册校验规则。
   */
  validationState: ComputedSignal<FieldValidationState<TValues>>

  /**
   * 关联的 scope。
   *
   * ValidationEffect 会取得该 Scope 的销毁权：调用 `effect.dispose()` 会销毁传入的整个 Scope。
   * 请传入仅由该 effect 所有的专用 Scope；Scope 销毁时会同步注销该字段的规则与错误。
   */
  scope: Scope
  /**
   * 读取当前字段 placeholder 的无追踪函数。
   *
   * Placeholder 只作为规则工厂元数据传递，不参与校验注册 effect 的依赖追踪。
   */
  placeholder?: () => string
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

/**
 * 保存一次校验规则注册所需的字段配置快照。
 */
interface ValidationRegistrationSnapshot<TValues extends Values = Values> {
  /**
   * 字段是否可见。
   */
  visible: boolean
  /**
   * 字段是否只读。
   */
  readonly: boolean
  /**
   * 字段是否禁用。
   */
  disabled: boolean
  /**
   * 用于错误提示的字段标签。
   */
  label: string
  /**
   * 用于规则工厂和错误提示的字段占位文本。
   */
  placeholder: string
  /**
   * 字段是否必填。
   */
  required: SchemxBaseField<TValues>["required"]
  /**
   * 字段当前规则列表。
   */
  rules: SchemxBaseField<TValues>["rules"] | PresetRuleEntry<unknown>
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
 * const effect = createValidationEffect({ context, nodeId, name, validationState, scope: effectScope })
 *
 * // 由专用 Scope 的拥有者在字段卸载时调用。
 * effect.dispose()
 * ```
 */
export function createValidationEffect<TValues extends Values = Values>(
  options: CreateValidationEffectOptions<TValues>
): ValidationEffect {
  const { context, nodeId, name, validationState, scope } = options

  const resolvePlaceholder = options.placeholder ?? (() => "")

  const taskScheduler = context.scheduler

  let registrationVersion = 0

  /**
   * 读取参与规则注册决策的响应式字段呈现态。
   *
   * 直接读取 validationState，避免订阅纯展示字段。
   */
  const resolveValidationRegistrationSnapshot =
    (): ValidationRegistrationSnapshot<TValues> => {
      const validationStateValue = validationState.value

      const fieldRules =
        Array.isArray(validationStateValue.rules) &&
        validationStateValue.rules.length === 0
          ? undefined
          : validationStateValue.rules

      const rawFallbackRules = options.fallbackRules?.()

      const fallbackRules =
        typeof rawFallbackRules === "function"
          ? (factoryContext: PresetRuleFactoryContext<PropertyKey>) =>
              rawFallbackRules({
                ...factoryContext,
                placeholder: resolvePlaceholder(),
              })
          : rawFallbackRules

      return {
        visible: validationStateValue.visible,
        readonly: validationStateValue.readonly,
        disabled: validationStateValue.disabled,
        label: validationStateValue.label,
        placeholder: resolvePlaceholder(),
        required: validationStateValue.required,
        rules: fieldRules ?? fallbackRules ?? [],
      }
    }

  /**
   * 根据当前字段呈现态注册或注销校验规则。
   */
  const applyValidationRegistration = (
    snapshot: ValidationRegistrationSnapshot<TValues>
  ): void => {
    const { visible, readonly, disabled, label, placeholder, required, rules } = snapshot

    context.validator.setFieldConfig({
      name,
      label,
      placeholder,
      required,
      active: visible && !readonly && !disabled,
    })
    context.validator.setFieldRules(
      name,
      !required && !hasRules(rules)
        ? undefined
        : (rules as FieldRules<TValues, NamePath<TValues>> | PresetRuleEntry<unknown>)
    )
  }

  /**
   * 将规则注册延后到 post 队列，避免与字段呈现态更新竞争。
   *
   * @param snapshot - 当前字段用于注册校验的配置快照。
   */
  const scheduleValidationRegistration = (
    snapshot: ValidationRegistrationSnapshot<TValues>
  ): void => {
    const currentVersion = ++registrationVersion

    taskScheduler.schedule({
      id: `validation:${nodeId}`,
      priority: "post",
      scope,
      run: () => {
        if (scope.disposed || currentVersion !== registrationVersion) {
          return
        }

        applyValidationRegistration(snapshot)
      },
    })
  }

  // 作用域释放时同步注销校验规则并清空错误
  scope.add(() => {
    registrationVersion += 1

    // 新节点已经接管同一路径时，旧 effect 不再移除该路径的校验配置。
    const replaced = context.nodeManager.getNodeIds(name).some(
      // 索引只包含仍在树中的身份；旧 effect 不移除替换节点的规则。
      (id) => id !== nodeId
    )

    if (!replaced) {
      context.validator.removeField(name)
    }
  })

  const disposeEffect = createSignalEffect(() => {
    scheduleValidationRegistration(resolveValidationRegistrationSnapshot())
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
 *
 * @typeParam TValues - 表单值类型。
 * @param rules - 要检查的字段规则。
 * @returns 存在至少一条可用规则时返回 `true`。
 */
function hasRules<TValues extends Values>(
  rules: SchemxBaseField<TValues>["rules"] | PresetRuleEntry<unknown>
): boolean {
  return Array.isArray(rules) ? rules.length > 0 : Boolean(rules)
}
