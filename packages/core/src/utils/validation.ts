/**
 * 校验触发工具
 *
 * 提供校验触发时机的归一化和匹配判断功能。
 *
 * @module utils/validation
 */

import { defaultSchemxConfig } from "../config"

import type { SchemxBaseField, ValidationTrigger } from "../types"

/**
 * 校验触发时机配置。
 *
 * 可传入单个触发时机，也可传入数组表示多个触发时机。
 */
export type TriggerConfig = ValidationTrigger | ValidationTrigger[]

/**
 * 归一化后的校验触发类型。
 */
export type NormalizedTrigger = "blur" | "change" | "submit"

/**
 * 归一化触发类型字符串。
 *
 * 将带 `on` 前缀的格式统一为短格式：
 * `"onBlur"` → `"blur"`、`"onChange"` → `"change"`、`"onSubmit"` → `"submit"`。
 * 不认识的值回退到默认配置的触发时机。
 *
 * @param t - 原始触发类型
 * @returns 归一化后的触发类型
 */
function normalizeTrigger(t: ValidationTrigger): NormalizedTrigger {
  const map: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  return map[t] || defaultSchemxConfig.validationTrigger
}

/**
 * 判断当前事件是否应该触发校验。
 *
 * 将配置的触发时机归一化后，与当前事件类型进行匹配。
 *
 * @param event - 当前触发的事件类型
 * @param trigger - 可选触发时机配置（支持单个或数组）
 *
 * @returns 是否应该触发校验
 *
 * @example
 * ```ts
 * shouldValidateOn("change", "onChange")              // => true
 * shouldValidateOn("blur", ["onBlur", "onChange"])    // => true
 * shouldValidateOn("change", "onSubmit")              // => false
 * shouldValidateOn("change", undefined)               // => false
 * ```
 */
export function shouldValidateOn(
  event: NormalizedTrigger,
  trigger?: TriggerConfig
): boolean {
  if (!trigger) return false
  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  return triggers.some((t) => normalizeTrigger(t) === event)
}

/**
 * 字段交互和校验共同使用的有效呈现状态。
 */
type FieldInteractionState = Pick<SchemxBaseField, "visible" | "readonly" | "disabled">

/**
 * 判断字段是否允许交互和参与有效校验。
 * @param context - 当前字段的可见、只读和禁用状态。
 * @example const active = isFieldInteractive({ visible: true, readonly: false, disabled: false })
 */
export function isFieldInteractive(context: FieldInteractionState): boolean {
  return (
    context.visible !== false && context.readonly !== true && context.disabled !== true
  )
}
