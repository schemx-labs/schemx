import type { NamePath, RequiredRule, Values } from "../types"
import type { ValidationRule } from "./types"

export { createStandardSchemaValidationRule } from "./standardSchema.adapter"

// required 规则默认采用的空值判定。
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
 * @param options - 必填声明和字段标签。
 * @param options.required - `true` 使用默认空值判断；对象形式可自定义空值判断和错误消息。
 * @param options.label - 未指定自定义消息时，用于生成默认错误消息的字段标签。
 * @returns 可注册到 Validator 的必填校验规则。
 *
 * @example
 * ```ts
 * const rule = createRequiredValidationRule({ required: true, label: "邮箱" })
 * ```
 */
export function createRequiredValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(options: {
  required: Exclude<RequiredRule<TValue>, false>
  label: string
}): ValidationRule<TValue, TValues, TName> {
  // 将布尔声明统一为可读取的配置对象。
  const config = options.required === true ? {} : options.required

  // 调用方自定义判定优先于默认判定。
  const isEmpty = config.isEmpty ?? defaultIsEmpty

  // 未自定义时使用字段标签生成可展示消息。
  const message =
    config.message ?? (options.label ? `${options.label}为必填项` : "此项为必填项")

  return {
    validate(value) {
      // 必填规则失败后中止后续规则，避免在空值上产生级联错误。
      return isEmpty(value)
        ? { valid: false, issues: [{ message, code: "required" }], bail: true }
        : { valid: true }
    },
  }
}
