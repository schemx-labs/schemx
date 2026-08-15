import type { NamePath, Values } from "../types/form"
import type { DefinedFieldValue } from "../types/rule"
import type {
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
} from "../types/validation"
import type { ValidationAdapterV1 } from "../types/validationAdapter"

export type {
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
} from "../types/validation"
export type { ValidationAdapterV1 } from "../types/validationAdapter"

/**
 * 由 adapter 创建、且只能由创建它的 adapter 实例识别的规则声明。
 *
 * 请使用对应 adapter 的 `rule()` 方法创建，不要手写此对象。
 */
export type AdapterRule = ValidationAdapterV1.Rule

/**
 * adapter 可接收的规则声明。
 *
 * @typeParam TInput - adapter 专属的原始规则输入类型。
 */
export type ValidationAdapterRule<TInput = unknown> =
  ValidationAdapterV1.RuleInput<TInput>

/**
 * adapter 的唯一标识。
 */
export type ValidationAdapterID = ValidationAdapterV1.ID

/**
 * {@link ValidationAdapterV1} 的兼容别名。
 *
 * 该类型用于将第三方规则输入转换为 Core 原生校验规则；新适配器建议直接声明为
 * `ValidationAdapterV1`，以显式绑定协议版本。
 *
 * @typeParam TInput - adapter 接收的规则输入类型。
 */
export type ValidationAdapter<TInput = unknown> = ValidationAdapterV1<TInput>

/**
 * 注册校验 adapter 时的可选行为。
 */
export interface ValidationAdapterRegistration {
  /** 要注册的 adapter 实例。 */
  readonly adapter: ValidationAdapter
  /**
   * 是否覆盖此前注册的同 ID adapter。
   *
   * 未设置时，同 ID 会被视为配置错误。
   */
  readonly override?: boolean
}

/**
 * 可直接注册 adapter，或通过 {@link ValidationAdapterRegistration} 指定覆盖行为。
 */
export type ValidationAdapterOption = ValidationAdapter | ValidationAdapterRegistration

/**
 * 字段级校验错误。
 *
 * `scope` 用于与表单级错误区分。
 *
 * @typeParam TName - 产生错误的字段路径类型。
 *
 * @example
 * ```ts
 * const error: FieldValidationError<"email"> = {
 *   scope: "field",
 *   name: "email",
 *   issues: [{ message: "邮箱格式不正确", code: "email" }],
 * }
 * ```
 */
export interface FieldValidationError<TName extends PropertyKey = string> {
  /**
   * 标识此错误归属于某个字段。
   */
  readonly scope: "field"
  /**
   * 产生错误的字段路径。
   */
  readonly name: TName
  /** 完整的字段校验问题，保留稳定 code 与原始 cause。 */
  readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
}

/**
 * 表单级校验错误，适用于不归属某个字段的失败。
 *
 * `scope` 用于与字段级错误区分。
 *
 * @example
 * ```ts
 * const error: FormValidationError = {
 *   scope: "form",
 *   issues: [{ message: "无法提交当前表单", code: "submit" }],
 * }
 * ```
 */
export interface FormValidationError {
  /**
   * 标识此错误不归属于特定字段。
   */
  readonly scope: "form"
  /** 完整的表单级校验问题，保留稳定 code 与原始 cause。 */
  readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
}

/**
 * 校验失败的统一错误表示。
 *
 * 通过 `scope` 判别字段级与表单级错误。
 *
 * @typeParam TName - 字段级错误中的字段路径类型。
 */
export type ValidationError<TName extends PropertyKey = string> =
  FieldValidationError<TName> | FormValidationError

/**
 * 校验成功结果。
 *
 * 成功时 `errors` 始终为空 tuple。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 */
export interface ValidationSuccess<TValues extends Values> {
  /** 表示本次校验已完成且没有问题。 */
  readonly valid: true
  /**
   * 用于本次校验的表单值。
   */
  readonly values: TValues
  /**
   * 成功结果固定为空 tuple。
   */
  readonly errors: readonly []
}

/**
 * 校验失败结果。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 * @typeParam TName - 字段级错误中的字段路径类型。
 *
 * @example
 * ```ts
 * const result: ValidationFailure<LoginForm> = {
 *   valid: false,
 *   values: { email: "invalid" },
 *   errors: [{ scope: "field", name: "email", issues: [{ message: "邮箱格式不正确" }] }],
 * }
 * ```
 */
export interface ValidationFailure<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 表示本次校验完成但存在问题。 */
  readonly valid: false
  /** 非取消失败固定为 false 或不存在。 */
  readonly cancelled?: false
  /**
   * 用于本次校验的表单值。
   */
  readonly values: TValues
  /**
   * 聚合后的字段级或表单级错误。
   */
  readonly errors: readonly ValidationError<TName>[]
}

/**
 * 已被较新校验、规则替换、字段移除或销毁中止的校验结果。
 *
 * 取消不代表值通过或不通过，调用方不得将其作为提交失败回调的依据。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 */
export interface ValidationCancelled<TValues extends Values> {
  // 取消不是成功结果。
  readonly valid: false
  // 用于区分普通失败与过期运行的显式标记。
  readonly cancelled: true
  // 本次运行开始时使用的表单值。
  readonly values: TValues
  // 取消不会携带不完整或陈旧的错误。
  readonly errors: readonly []
}

/**
 * Validator 的校验结果。
 *
 * 可通过 `valid` 判别成功与失败分支。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 * @typeParam TName - 字段级错误中的字段路径类型。
 *
 * @example
 * ```ts
 * const result = await validator.validate(values)
 * if (!result.valid) console.log(result.errors)
 * ```
 */
export type ValidationResult<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> =
  | ValidationSuccess<TValues>
  | ValidationFailure<TValues, TName>
  | ValidationCancelled<TValues>

/**
 * 创建 Validator 的配置。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * createValidator({ onRuleError: () => "校验执行失败" })
 * ```
 */
export interface CreateValidatorOptions<TValues extends Values> {
  /**
   * 将规则抛出的异常转换为展示给用户的错误消息。
   *
   * @param error - 规则执行时抛出的原始异常。
   * @param context - 发生异常的字段校验上下文。
   * @returns 用于字段错误状态的消息。
   */
  onRuleError?: (
    error: unknown,
    context: ValidationRuleContext<TValues, NamePath<TValues>>
  ) => string
}

/**
 * 管理字段规则、错误状态和异步校验生命周期的校验器。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const validator = createValidator<LoginForm>()
 * validator.setFieldRules("email", [emailRule])
 * const result = await validator.validate({ email: "a@example.com" })
 * ```
 */
export interface Validator<TValues extends Values> {
  /**
   * 用新的规则数组替换指定字段的全部规则。
   *
   * @typeParam TName - 字段路径。
   * @param name - 要配置的字段路径。
   * @param rules - 规则数组；校验器会复制该数组，后续外部修改不会生效。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: readonly ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>[]
  ): void
  /**
   * 替换多个字段的全部规则。
   *
   * @param fields - 字段路径及其对应的原生规则数组。
   */
  setFieldsRules(
    fields: readonly {
      readonly name: NamePath<TValues>
      readonly rules: readonly ValidationRule[]
    }[]
  ): void
  /**
   * 移除字段规则，并中止该字段仍在进行的校验。
   *
   * @param name - 要移除的字段路径。
   */
  removeFieldRules(name: NamePath<TValues>): void
  /**
   * 移除多个字段的规则，并中止这些字段仍在进行的校验。
   *
   * @param names - 要移除规则的字段路径数组。
   */
  removeFieldsRules(names: readonly NamePath<TValues>[]): void
  /**
   * 获取字段当前错误消息的不可变快照。
   *
   * @param name - 要读取的字段路径。
   * @returns 错误消息数组；没有错误时返回稳定的空数组。
   */
  getFieldErrors(name: NamePath<TValues>): readonly string[]
  /**
   * 获取多个字段当前错误消息的不可变快照。
   *
   * 未传入路径时返回当前存在错误的字段；传入路径时按传入顺序返回结果，
   * 即使某个字段没有错误也会包含空数组。
   *
   * @param names - 可选的字段路径数组。
   * @returns 带字段路径和错误消息的只读条目数组。
   */
  getFieldsErrors(names?: readonly NamePath<TValues>[]): readonly {
    readonly name: NamePath<TValues>
    readonly errors: readonly string[]
  }[]
  /**
   * 直接设置字段错误消息。
   *
   * @param name - 要写入的字段路径。
   * @param messages - 要展示的错误消息；校验器会复制该数组。
   */
  setFieldErrors(name: NamePath<TValues>, messages: readonly string[]): void
  /**
   * 替换多个字段的错误消息。
   *
   * @param fields - 字段路径及其对应的错误消息数组。
   */
  setFieldsErrors(
    fields: readonly {
      readonly name: NamePath<TValues>
      readonly messages: readonly string[]
    }[]
  ): void
  /**
   * 覆盖字段规则配置解析产生的问题。
   *
   * 该方法主要供 ValidationController 写入无法解析的字段配置；external 错误请使用
   * {@link Validator.setFieldErrors}。
   *
   * @param name - 要写入的字段路径。
   * @param issues - 完整 validation 问题；空数组清除该来源。
   */
  setFieldConfigurationIssues(
    name: NamePath<TValues>,
    issues: readonly ValidationRuleIssue[]
  ): void
  /**
   * 覆盖多个字段规则配置解析产生的问题。
   *
   * @param fields - 字段路径及其对应的配置问题数组。
   */
  setFieldsConfigurationIssues(
    fields: readonly {
      readonly name: NamePath<TValues>
      readonly issues: readonly ValidationRuleIssue[]
    }[]
  ): void
  /**
   * 清除字段规则配置解析产生的问题。
   *
   * @param name - 要清除的字段路径。
   */
  clearFieldConfigurationIssues(name: NamePath<TValues>): void
  /**
   * 清除多个字段规则配置解析产生的问题。
   *
   * @param names - 要清除配置问题的字段路径数组。
   */
  clearFieldsConfigurationIssues(names: readonly NamePath<TValues>[]): void
  /**
   * 清除指定字段的错误消息。
   *
   * @param name - 要清除的字段路径。
   */
  clearFieldErrors(name: NamePath<TValues>): void
  /**
   * 清除多个字段的全部错误来源。
   *
   * @param names - 要清除错误的字段路径数组。
   */
  clearFieldsErrors(names: readonly NamePath<TValues>[]): void
  /**
   * 清除全部字段错误消息。
   */
  clearErrors(): void
  /**
   * 执行单个字段的规则，并更新该字段的错误状态。
   *
   * 新一次调用会中止同一字段尚未完成的校验；旧调用仍会返回其本地结果。
   *
   * @typeParam TName - 字段路径。
   * @param name - 要校验的字段路径。
   * @param values - 用于读取字段值和提供规则上下文的表单值快照。
   * @returns 包含该字段错误的校验结果。
   */
  validateField<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): Promise<ValidationResult<TValues, TName>>
  /**
   * 并行执行全部已注册字段的规则。
   *
   * @param values - 用于全部规则的表单值快照。
   * @returns 聚合全部字段错误的校验结果。
   */
  validate(values: TValues): Promise<ValidationResult<TValues>>
  /**
   * 中止全部运行中的校验并释放校验器状态。
   *
   * 该操作可重复调用。销毁后规则和错误均被清空，后续校验返回显式取消结果，
   * 写入规则或错误状态的方法不再产生效果；已发起的校验不会再写入错误状态。
   */
  destroy(): void
}
