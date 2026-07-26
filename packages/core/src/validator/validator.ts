import { getByPath } from "../utils"
import { createFieldKey } from "../utils/path"

import { FieldErrorStore } from "./errorStore"

import type {
  CreateValidatorOptions,
  FieldValidationError,
  ValidationError,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  Validator,
} from "./types"
import type { NamePath, Values } from "../types/form"
import type { DefinedFieldValue } from "../types/rule"

/**
 * 正在执行的单字段校验运行。
 */
interface ValidationRun {
  // 递增版本，用于拒绝陈旧运行的状态提交。
  readonly version: number
  // 供异步规则主动停止工作的信号。
  readonly controller: AbortController
}

/**
 * 已注册字段的原始路径与规则快照。
 */
interface FieldRuleRecord<TValues extends Values> {
  // 用于读取值和构造公开结果的原始路径。
  readonly name: NamePath<TValues>
  // 运行时执行的防御性规则数组。
  readonly rules: readonly ValidationRule[]
}

/**
 * 无错误时复用的冻结消息快照。
 */
const EMPTY_MESSAGES: readonly string[] = Object.freeze([])

/**
 * 执行原生规则、协调字段取消并维护错误来源的 Validator 实现。
 */
class ValidatorImpl<TValues extends Values> implements Validator<TValues> {
  // 按稳定字段身份保存的可执行规则。
  private readonly rules = new Map<string, FieldRuleRecord<TValues>>()
  // 字段 configuration/validation/external 错误的响应式仓库。
  private readonly errors = new FieldErrorStore<TValues>()
  // 当前仍可能提交状态的单字段运行。
  private readonly runs = new Map<string, ValidationRun>()
  // 用于生成单调递增运行版本的计数器。
  private nextVersion = 0
  // 销毁后阻止新的运行与状态写入。
  private destroyed = false

  /**
   * 创建 Validator 实例。
   *
   * @param options - 规则异常消息映射等执行选项。
   */
  public constructor(private readonly options: CreateValidatorOptions<TValues> = {}) {}

  /**
   * 替换字段规则并取消由旧规则启动的运行。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 要替换规则的字段路径。
   * @param rules - 新的原生规则数组。
   */
  public setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: readonly ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>[]
  ): void {
    if (this.destroyed) return

    // 规则和运行状态共享的稳定字段身份。
    const key = createFieldKey(name)

    this.abortRun(key)
    this.rules.set(key, { name, rules: [...rules] })
    this.errors.clearValidation(name)
  }

  /**
   * 移除字段规则、中止运行并清除该字段全部错误来源。
   *
   * @param name - 要移除的字段路径。
   */
  public removeFieldRules(name: NamePath<TValues>): void {
    // 待移除字段的稳定身份。
    const key = createFieldKey(name)

    this.rules.delete(key)
    this.abortRun(key)
    this.errors.clearField(name)
  }

  /**
   * 返回字段当前可展示错误消息的防御性快照。
   *
   * @param name - 要读取的字段路径。
   * @returns configuration、validation 与 external 错误合并后的消息；无错误时返回稳定空数组。
   */
  public getFieldErrors(name: NamePath<TValues>): readonly string[] {
    // 错误仓库返回的可展示消息快照。
    const messages = this.errors.getMessages(name)

    return messages.length > 0 ? messages : EMPTY_MESSAGES
  }

  /**
   * 覆盖字段 external 错误，不影响正在运行的规则校验。
   *
   * @param name - 要写入的字段路径。
   * @param messages - 服务端或调用方提供的消息；空数组清除 external 来源。
   */
  public setFieldErrors(name: NamePath<TValues>, messages: readonly string[]): void {
    if (this.destroyed) return

    this.errors.replaceExternal(name, messages)
  }

  /**
   * 覆盖字段规则配置解析失败问题，不会被后续规则执行清除。
   *
   * @param name - 要写入的字段路径。
   * @param issues - 完整 validation 问题；空数组清除该来源。
   */
  public setFieldConfigurationIssues(
    name: NamePath<TValues>,
    issues: readonly ValidationRuleIssue[]
  ): void {
    if (this.destroyed) return

    this.errors.replaceConfiguration(name, issues)
  }

  /**
   * 清除字段规则配置解析失败问题。
   *
   * @param name - 要清除的字段路径。
   */
  public clearFieldConfigurationIssues(name: NamePath<TValues>): void {
    if (this.destroyed) return

    this.errors.clearConfiguration(name)
  }

  /**
   * 清除字段全部错误来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearFieldErrors(name: NamePath<TValues>): void {
    this.errors.clearField(name)
  }

  /**
   * 清除全部字段的 configuration、validation 与 external 错误。
   */
  public clearErrors(): void {
    this.errors.clear()
  }

  /**
   * 执行一个字段的规则，并在运行仍为最新时替换 validation 错误。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 要校验的字段路径。
   * @param values - 本次运行使用的表单值快照。
   * @returns 成功、失败或显式取消结果。
   */
  public async validateField<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): Promise<ValidationResult<TValues, TName>> {
    if (this.destroyed) return this.cancelled(values)

    // 当前字段的稳定运行身份。
    const key = createFieldKey(name)

    // 唯一允许提交本次状态的运行令牌。
    const run = this.startRun(key)

    // 在运行开始时取得规则快照。
    const record = this.rules.get(key)

    // 未配置规则的字段仍需参与 external/configuration 错误聚合。
    const rules = record?.rules ?? []

    // 按当前路径从本次表单快照读取字段值。
    const value = getByPath(values, name) as DefinedFieldValue<TValues, TName> | undefined

    // 传给每条规则的不可写执行上下文。
    const context: ValidationRuleContext<TValues, TName> = {
      name,
      values,
      signal: run.controller.signal,
    }

    // 本次规则执行产生的问题；undefined 表示已中止。
    const issues = await this.executeRules(rules, value, context)

    if (issues === undefined || run.controller.signal.aborted || this.destroyed) {
      return this.cancelled(values)
    }

    if (this.runs.get(key)?.version !== run.version) {
      return this.cancelled(values)
    }

    this.runs.delete(key)
    this.errors.replaceValidation(name, issues)

    return this.fieldResult(name, values)
  }

  /**
   * 并行执行全部已注册字段，并将 external-only 字段纳入最终结果。
   *
   * @param values - 本次运行使用的表单值快照。
   * @returns 成功、失败或任一字段被取消时的取消结果。
   */
  public async validate(values: TValues): Promise<ValidationResult<TValues>> {
    if (this.destroyed) return this.cancelled(values)

    // 复制规则记录，避免校验期间注册表变化影响本轮范围。
    const records = [...this.rules.values()]

    // 各字段独立运行，以避免慢规则阻塞无关字段。
    const results = await Promise.all(
      records.map((record) => this.validateField(record.name, values))
    )

    if (results.some((result) => !result.valid && result.cancelled)) {
      return this.cancelled(values)
    }

    // 最终公开结果中的字段与表单错误。
    const errors: ValidationError<NamePath<TValues>>[] = []

    // 已由本轮规则运行覆盖的字段身份。
    const validatedKeys = new Set(records.map((record) => createFieldKey(record.name)))

    for (const result of results) {
      if (!result.valid) errors.push(...result.errors)
    }

    for (const entry of this.errors.entries()) {
      if (validatedKeys.has(createFieldKey(entry.name))) continue
      const fieldError = this.createFieldError(entry.name, entry.issues)

      if (fieldError) errors.push(fieldError)
    }

    return errors.length === 0 ? this.success(values) : { valid: false, values, errors }
  }

  /**
   * 中止全部运行并释放规则与错误状态。
   */
  public destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    for (const run of this.runs.values()) run.controller.abort()
    this.runs.clear()
    this.rules.clear()
    this.errors.clear()
  }

  /**
   * 启动字段新运行，并使同字段旧运行进入取消状态。
   */
  private startRun(key: string): ValidationRun {
    this.abortRun(key)
    const run = {
      version: ++this.nextVersion,
      controller: new AbortController(),
    }

    this.runs.set(key, run)

    return run
  }

  /**
   * 中止一个字段当前仍在执行的运行。
   */
  private abortRun(key: string): void {
    // 仍可取消的当前字段运行。
    const run = this.runs.get(key)

    if (!run) return

    run.controller.abort()
    this.runs.delete(key)
  }

  /**
   * 顺序执行字段规则；任何中止都会立即停止后续规则。
   */
  private async executeRules<TValue, TName extends NamePath<TValues>>(
    rules: readonly ValidationRule<TValue, TValues, TName>[],
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): Promise<readonly ValidationRuleIssue[] | undefined> {
    // 按规则声明顺序累积的完整问题。
    const issues: ValidationRuleIssue[] = []

    for (const rule of rules) {
      if (context.signal.aborted) return undefined

      try {
        // 等待单条规则完成，随后再次确认运行未被中止。
        const result = await rule.validate(value, context)

        if (context.signal.aborted) return undefined

        if (!isValidationRuleResult(result)) {
          throw new TypeError("校验规则必须返回合法的 ValidationRuleResult")
        }

        if (!result.valid) {
          issues.push(...result.issues)
          if (result.bail) break
        }
      } catch (error) {
        if (context.signal.aborted) return undefined
        issues.push(this.getRuleErrorIssue(error, context))
      }
    }

    return issues
  }

  /**
   * 将规则异常或规则契约错误映射为稳定 issue。
   */
  private getRuleErrorIssue<TName extends NamePath<TValues>>(
    error: unknown,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleIssue {
    try {
      // 调用方可为异常提供领域消息；否则采用稳定默认文案。
      const message =
        this.options.onRuleError?.(
          error,
          context as ValidationRuleContext<TValues, NamePath<TValues>>
        ) ?? "校验执行失败"

      return { message, code: "rule_execution", cause: error }
    } catch (handlerError) {
      return { message: "校验执行失败", code: "rule_execution", cause: handlerError }
    }
  }

  /**
   * 由当前错误仓库创建一个字段级公开错误。
   */
  private fieldResult<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): ValidationResult<TValues, TName> {
    // 将当前合并错误仓库转换为公开字段错误。
    const fieldError = this.createFieldError(name, this.errors.getIssues(name))

    return fieldError
      ? { valid: false, values, errors: [fieldError] }
      : this.success(values)
  }

  /**
   * 将非空 issue 列表包装为字段错误，空数组返回 `undefined`。
   */
  private createFieldError<TName extends NamePath<TValues>>(
    name: TName,
    issues: readonly ValidationRuleIssue[]
  ): FieldValidationError<TName> | undefined {
    if (issues.length === 0) return undefined

    return {
      scope: "field",
      name,
      issues: issues as [ValidationRuleIssue, ...ValidationRuleIssue[]],
    }
  }

  /**
   * 创建成功结果。
   */
  private success<TName extends NamePath<TValues> = NamePath<TValues>>(
    values: TValues
  ): ValidationResult<TValues, TName> {
    return { valid: true, values, errors: [] }
  }

  /**
   * 创建不携带陈旧错误的取消结果。
   */
  private cancelled<TName extends NamePath<TValues> = NamePath<TValues>>(
    values: TValues
  ): ValidationResult<TValues, TName> {
    return { valid: false, cancelled: true, values, errors: [] }
  }
}

/**
 * 判断未知返回值是否满足运行时规则结果契约。
 */
function isValidationRuleResult(value: unknown): value is
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
      readonly bail?: boolean
    } {
  if (typeof value !== "object" || value === null || !("valid" in value)) return false
  if ((value as { valid?: unknown }).valid === true) return true
  if ((value as { valid?: unknown }).valid !== false) return false

  // 失败分支必须携带至少一个包含 message 的 issue。
  const issues = (value as { issues?: unknown }).issues

  return (
    Array.isArray(issues) &&
    issues.length > 0 &&
    issues.every(
      (issue) =>
        typeof issue === "object" &&
        issue !== null &&
        typeof (issue as { message?: unknown }).message === "string"
    )
  )
}

/**
 * 创建独立字段校验器。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 规则异常映射等执行选项。
 * @returns 管理规则、错误和异步运行生命周期的 Validator。
 */
export function createValidator<TValues extends Values = Values>(
  options?: CreateValidatorOptions<TValues>
): Validator<TValues> {
  return new ValidatorImpl(options)
}

export type {
  CreateValidatorOptions,
  ValidationCancelled,
  ValidationError,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  Validator,
} from "./types"
