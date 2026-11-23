/**
 * 校验触发工具
 *
 * 提供校验触发时机的合并、归一化和匹配判断功能。
 *
 * @module utils/validation
 */

import { defaultConfig } from "../defaultConfig"

import type { ValidationTrigger } from "../types"

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
 * 判断触发时机配置是否有效。
 *
 * undefined 和空数组视为无效，其余值（包括单个字符串、非空数组）视为有效。
 *
 * @param v - 触发时机配置
 *
 * @returns 配置有效时返回 true
 */
function isValidTrigger(v: TriggerConfig | undefined): v is TriggerConfig {
  if (v === undefined) return false

  if (Array.isArray(v) && v.length === 0) return false

  return true
}

/**
 * 合并校验触发时机配置。
 *
 * 按优先级从高到低取值：列级配置 > 表单上下文配置 > 默认值。
 * 跳过 undefined 和空数组，确保空数组不会意外覆盖后续配置。
 *
 * @param columnTrigger - 列级配置的触发时机
 * @param contextTrigger - 表单上下文配置的触发时机
 * @param defaultTrigger - 兜底默认值
 *
 * @returns 最终生效的触发时机
 *
 * @example
 * ```ts
 * mergeTrigger("onBlur", "onChange", "onSubmit")       // => "onBlur"
 * mergeTrigger(undefined, "onChange", "onSubmit")       // => "onChange"
 * mergeTrigger([], "onChange", "onSubmit")              // => "onChange"
 * mergeTrigger(undefined, undefined, "onSubmit")        // => "onSubmit"
 * ```
 */
export function mergeTrigger(
  columnTrigger: TriggerConfig | undefined,
  contextTrigger: TriggerConfig | undefined,
  defaultTrigger: TriggerConfig
): TriggerConfig {
  if (isValidTrigger(columnTrigger)) return columnTrigger

  if (isValidTrigger(contextTrigger)) return contextTrigger

  return defaultTrigger
}

/**
 * 归一化触发类型字符串。
 *
 * 将带 `on` 前缀的格式统一为短格式：
 * `"onBlur"` → `"blur"`、`"onChange"` → `"change"`、`"onSubmit"` → `"submit"`。
 *
 * @param t - 原始触发类型
 *
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

  return map[t] || defaultConfig.validationTrigger
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
