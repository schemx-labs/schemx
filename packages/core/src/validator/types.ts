/**
 * Validator 的规则、adapter、错误和结果类型。
 *
 * 根入口只选择性导出公共类型；`Validator` 接口仅供 Core 内部 FormModel 使用。
 *
 * @module core/validator/types
 */

import type {
  DefinedFieldValue,
  FieldArrayChange,
  FieldRules,
  NamePath,
  RequiredConfig,
  ValidationAdapterV1,
  Values,
} from "../types"

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
  /**
   * 要注册的 adapter 实例。
   */
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
 * Validator 保存的字段校验元数据。
 *
 * 该配置不保存解析后的原生规则；Validator 会在执行校验前根据当前 Registry
 * 和 adapter 路由动态解析。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FieldValidationConfig<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 要配置的字段路径。
   */
  readonly name: TName
  /**
   * 用于规则工厂和错误消息的字段标签。
   */
  readonly label: string
  /**
   * 字段的必填声明。
   */
  readonly required: RequiredConfig<DefinedFieldValue<TValues, TName>> | undefined
}

/**
 * 可被 Validator 执行的原生校验规则。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 *
 * @example
 * ```ts
 * const rule: ValidationRule<string> = {
 *   validate: (value) =>
 *     value ? { valid: true } : {
 *       valid: false,
 *       issues: [{ type: "validation", message: "值不能为空" }],
 *     },
 * }
 * ```
 */
export interface ValidationRule<
  TValue = unknown,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 执行单条规则并返回同步或异步校验结果。
   *
   * @param value - 当前字段值；字段不存在时为 `undefined`。
   * @param context - 提供字段路径、表单快照和取消信号的只读上下文。
   * @returns 同步或异步的规则执行结果。
   */
  validate(
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleResult | Promise<ValidationRuleResult>
}

/**
 * 运行校验规则时提供的只读上下文。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 */
export interface ValidationRuleContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 当前正在校验的字段路径。
   */
  readonly name: TName
  /**
   * 当前表单值的只读快照。
   */
  readonly values: Readonly<TValues>
  /**
   * 用于中止异步规则执行的信号。
   */
  readonly signal: AbortSignal
}

/**
 * 单条校验失败信息。
 */
export interface ValidationRuleIssue {
  /**
   * 标识错误来自规则校验、规则配置或外部调用方。
   */
  readonly type?: "validation" | "configuration" | "external"
  /**
   * 面向用户的错误提示。
   */
  readonly message: string
  /**
   * 可选的稳定错误编码。
   */
  readonly code?: string
  /**
   * 导致该问题的原始异常或上下文。
   */
  readonly cause?: unknown
}

/**
 * 校验规则的执行结果。
 */
export type ValidationRuleResult =
  | { readonly valid: true }
  | {
      /**
       * 失败结果标记。
       */
      readonly valid: false
      /**
       * 至少包含一个问题的错误列表。
       */
      readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
      /**
       * 是否阻止后续规则继续执行。
       */
      readonly bail?: boolean
    }

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
 *   issues: [{ type: "validation", message: "邮箱格式不正确", code: "email" }],
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
  /**
   * 完整的字段校验问题，保留稳定 `code` 与原始 `cause`。
   */
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
 *   issues: [{ type: "validation", message: "无法提交当前表单", code: "submit" }],
 * }
 * ```
 */
export interface FormValidationError {
  /**
   * 标识此错误不归属于特定字段。
   */
  readonly scope: "form"
  /**
   * 完整的表单级校验问题，保留稳定 `code` 与原始 `cause`。
   */
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
  /**
   * 表示本次校验已完成且没有问题。
   */
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
 *   errors: [{
 *     scope: "field",
 *     name: "email",
 *     issues: [{ type: "validation", message: "邮箱格式不正确" }],
 *   }],
 * }
 * ```
 */
export interface ValidationFailure<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 表示本次校验完成但存在问题。
   */
  readonly valid: false
  /**
   * 非取消失败固定为 `false` 或不存在。
   */
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
  /**
   * 取消不是成功结果。
   */
  readonly valid: false
  /**
   * 用于区分普通失败与过期运行的显式标记。
   */
  readonly cancelled: true
  /**
   * 本次运行开始时使用的表单值。
   */
  readonly values: TValues
  /**
   * 取消不会携带不完整或陈旧的错误。
   */
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
 * 管理字段规则、错误状态和异步校验生命周期的 Core 内部校验器。
 *
 * `Validator` 不从 `@schemx/core` 根入口导出。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @internal
 */
export interface Validator<TValues extends Values> {
  /**
   * 保存字段校验元数据；规则会在字段校验前动态解析。
   *
   * @typeParam TName - 字段路径。
   * @param config - 字段路径、标签和必填状态。
   */
  setFieldConfig<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): void

  /**
   * 保存字段的原始规则声明；规则会在字段校验前动态解析。
   *
   * @typeParam TName - 字段路径。
   * @param name - 字段路径。
   * @param rules - 原始规则声明；传 `undefined` 表示移除规则。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName> | undefined
  ): void

  /**
   * 只移除字段原始规则；字段元数据和必填校验保持不变。
   *
   * @param name - 字段路径。
   */
  removeFieldRules(name: NamePath<TValues>): void
  /**
   * 移除字段规则配置，并中止该字段仍在进行的校验。
   *
   * @param name - 要移除的字段路径。
   */
  removeField(name: NamePath<TValues>): void
  /**
   * 清理 FieldArray 结构变化后的过期规则运行结果。
   *
   * 越界字段的规则配置会被移除；仍在有效范围内且受本次变更影响的字段只会中止当前运行。
   *
   * @param path - 发生结构变更的数组字段路径。
   * @param change - 本次数组结构变化描述。
   */
  invalidateFieldArray(path: NamePath<TValues>, change: FieldArrayChange): void
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
   * 该操作可重复调用。销毁后规则和已保存的字段错误均被清空，后续校验返回显式取消结果；
   * 已发起的校验不会再写入错误状态。
   */
  destroy(): void
}
