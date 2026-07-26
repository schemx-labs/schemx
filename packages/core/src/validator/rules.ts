import type { NamePath, RequiredRule, StandardSchemaV1, Values } from "../types"
import type { ValidationRule } from "./types"

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
      return isEmpty(value)
        ? { valid: false, issues: [{ message, code: "required" }], bail: true }
        : { valid: true }
    },
  }
}

/**
 * 将 Standard Schema 包装为原生校验规则。
 *
 * 仅转换 Standard Schema 的错误信息，不会使用其输出值改写表单状态。
 *
 * @typeParam TValue - Standard Schema 接收的字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param schema - 实现 Standard Schema V1 协议的校验器。
 * @returns 可注册到 Validator 的校验规则。
 *
 * @example
 * ```ts
 * const rule = createStandardSchemaValidationRule(emailSchema)
 * ```
 */
export function createStandardSchemaValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(schema: StandardSchemaV1<TValue, unknown>): ValidationRule<TValue, TValues, TName> {
  return {
    async validate(value) {
      // Standard Schema 的输出值不参与表单写入，仅消费问题列表。
      const result = await schema["~standard"].validate(value)

      // 将协议问题收敛到 Core 的公开 issue 形状。
      const issues = result.issues?.map((issue) => ({ message: issue.message })) ?? []

      return issues.length > 0
        ? { valid: false, issues: [issues[0], ...issues.slice(1)] }
        : { valid: true }
    },
  }
}
