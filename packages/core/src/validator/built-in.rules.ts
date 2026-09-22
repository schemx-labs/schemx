/**
 * Validator 内置规则工厂。
 *
 * @module core/validator/built-in.rules
 */

import type { PresetRuleFactoryContext } from "../registry"
import type { NamePath, Values } from "../types"
import type { ValidationRule } from "./types"

export { createStandardSchemaValidationRule } from "./standardSchema.adapter"

type RequiredRuleContext<TValue = unknown> = Pick<
  PresetRuleFactoryContext<PropertyKey, TValue>,
  "required" | "label" | "placeholder"
>

/**
 * 判断值是否满足 `required` 规则的默认空值条件。
 *
 * @param value - 待判断的字段值。
 * @returns 值为 `undefined`、`null`、空字符串或空数组时返回 `true`。
 */
const defaultIsEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)

/**
 * 根据字段必填配置创建原生校验规则。
 *
 * 默认将 `undefined`、`null`、空字符串和空数组视为空值；失败时会中止后续规则。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param context - 必填声明、字段标签和占位文本。
 * @param context.required - `false` 跳过必填校验；`true` 使用默认空值判断；对象形式可自定义空值判断和错误消息。
 * @param context.label - 未指定自定义消息时，用于生成默认错误消息的字段标签。
 * @param context.placeholder - 字段占位文本。
 * @returns 可注册到 Validator 的必填校验规则。
 *
 * @example
 * ```ts
 * const rule = createRequiredValidationRule({
 *   required: true,
 *   label: "邮箱",
 *   placeholder: "请输入邮箱",
 * })
 * ```
 */
export function createRequiredValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(context: RequiredRuleContext<TValue>): ValidationRule<TValue, TValues, TName> {
  if (!context.required) {
    return {
      validate: () => ({ valid: true }),
    }
  }

  // 将布尔声明统一为可读取的配置对象。
  const config = context.required === true ? {} : context.required

  // 调用方自定义判定优先于默认判定。
  const isEmpty = config.isEmpty ?? defaultIsEmpty

  // 未自定义时使用字段标签生成可展示消息。
  const message =
    config.message ?? (context.label ? `${context.label}为必填项` : "此项为必填项")

  return {
    validate(value) {
      // 必填规则失败后中止后续规则，避免在空值上产生级联错误。
      return isEmpty(value)
        ? {
            valid: false,
            issues: [{ type: "validation", message, code: "required" }],
            bail: true,
          }
        : { valid: true }
    },
  }
}
