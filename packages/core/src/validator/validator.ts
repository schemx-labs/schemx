/**
 * Core 内部 Validator 的规则解析、执行和错误状态协调实现。
 *
 * 本模块只由 FormModel 使用；`createValidator` 不从 `@schemx/core` 根入口导出。
 *
 * @module core/validator/validator
 */

import { yieldToHost } from "../runtime/scheduler/scheduler"
import { getByPath } from "../utils"
import {
  createFieldKey,
  isFieldArrayDescendantAffected,
  isFieldArrayDescendantOutOfRange,
} from "../utils/path"

import { createValidationAdapterMap, findValidationAdapter } from "./adapters"
import { createAsyncValidatorAdapter } from "./asyncValidator.adapter"
import {
  createValidationCancelled,
  createValidationFailure,
  createValidationSuccess,
} from "./result"
import { createStandardSchemaAdapter } from "./standardSchema.adapter"

import type { PresetRuleEntry, PresetRuleRegistry } from "../registry"
import type { Store } from "../store"
import type {
  FieldValidationConfig,
  FieldValidationError,
  ValidationAdapter,
  ValidationAdapterID,
  ValidationAdapterOption,
  ValidationError,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  Validator,
} from "./types"
import type {
  DefinedFieldValue,
  FieldArrayChange,
  FieldRule,
  FieldRules,
  NamePath,
  RequiredConfig,
  Values,
} from "../types"

/**
 * 创建 Core 内部 Validator 的配置。
 *
 * 该配置只供 `FormModel` 装配校验域使用，不属于 `@schemx/core` 根入口的公开 API。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @internal
 */
export interface CreateValidatorOptions<TValues extends Values> {
  /**
   * 用于解析 `rules` 中命名规则的注册中心。
   */
  readonly presetRuleRegistry: PresetRuleRegistry
  /**
   * 用于共享字段错误状态的容器。
   */
  readonly fieldStore: Store<TValues>

  /**
   * 当前校验域使用的第三方规则 adapter。
   */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]

  /**
   * 将规则抛出的异常转换为展示给用户的错误消息。
   *
   * @param error - 规则执行时抛出的原始异常。
   * @param context - 发生异常的字段校验上下文。
   * @returns 用于字段错误状态的消息。
   */
  readonly onRuleError?: (
    error: unknown,
    context: ValidationRuleContext<TValues, NamePath<TValues>>
  ) => string

  /**
   * 整表校验时同时运行的字段数；小于 1 的值会归一为 1。
   *
   * @defaultValue 8
   */
  readonly validationConcurrency?: number
}

/**
 * 正在执行的单字段校验运行。
 */
interface ValidationRun {
  // 递增版本，用于拒绝陈旧运行的状态提交。
  readonly version: number
  // 供异步规则主动停止工作的信号。
  readonly controller: AbortController
}

// 单个字段的原始规则记录；与字段元数据分开维护。
interface FieldRuleRecord<TValues extends Values> {
  // 规则所属的字段路径。
  readonly name: NamePath<TValues>
  // 尚未解析为原生规则的原始声明。
  readonly rules:
    FieldRules<TValues, NamePath<TValues>> | PresetRuleEntry<unknown> | undefined
}

/**
 * 未指定并发数时，整表校验同时执行的字段数量。
 */
const DEFAULT_VALIDATION_CONCURRENCY = 8

/**
 * 单字段连续执行规则达到该数量后，主动让出主线程。
 */
const DEFAULT_RULES_PER_TIME_SLICE = 16

/**
 * 执行原生规则、协调字段取消并维护错误来源的 Validator 实现。
 */
class ValidatorImpl<TValues extends Values> implements Validator<TValues> {
  // 命名规则注册中心；每次字段校验时读取最新规则。
  private readonly presetRuleRegistry: PresetRuleRegistry

  // 字段 configuration/validation/external 错误的响应式状态容器。
  private readonly fieldStore: Store<TValues>

  // 保存字段校验元数据；规则解析时用于 label、placeholder、required 和错误提示。
  private readonly fieldConfigs = new Map<
    string,
    FieldValidationConfig<TValues, NamePath<TValues>>
  >()

  // 保存字段原始规则；可执行规则在校验前动态解析。
  private readonly fieldRules = new Map<string, FieldRuleRecord<TValues>>()

  // 公开 setFieldRules 的覆盖层；Runtime 声明规则不会覆盖它。
  private readonly manualFieldRules = new Map<string, FieldRuleRecord<TValues>>()

  // 按注册顺序保存可识别字段规则的 adapter。
  private readonly adapters: ReadonlyMap<ValidationAdapterID, ValidationAdapter>

  // 当前仍可能提交状态的单字段运行。
  private readonly runs = new Map<string, ValidationRun>()

  // 用于生成单调递增运行版本的计数器。
  private nextVersion = 0

  // 销毁后阻止新的运行与状态写入。
  private destroyed = false

  /**
   * 创建 Validator 实例。
   *
   * @param options - Validator 的依赖和执行选项。
   */
  public constructor(private readonly options: CreateValidatorOptions<TValues>) {
    this.presetRuleRegistry = options.presetRuleRegistry
    this.fieldStore = options.fieldStore
    const standardSchemaAdapter = createStandardSchemaAdapter()

    const asyncValidatorAdapter = createAsyncValidatorAdapter()

    this.adapters = createValidationAdapterMap([
      ...(options.validatorAdapters ?? []),
      standardSchemaAdapter,
      asyncValidatorAdapter,
    ])
  }

  /**
   * 保存字段规则配置并取消由旧配置启动的运行。
   *
   * @typeParam TName - 字段路径类型。
   * @param config - 字段路径、标签、占位文本和必填状态。
   */
  public setFieldConfig<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): void {
    if (this.destroyed) return

    const key = createFieldKey(config.name)

    this.abortRun(key)

    const storedConfig = {
      name: config.name,
      label: config.label,
      placeholder: config.placeholder,
      required: config.required,
      active: config.active,
    } as FieldValidationConfig<TValues, NamePath<TValues>>

    this.fieldConfigs.set(key, storedConfig)

    this.clearResolvedFieldErrors(config.name)
  }

  /**
   * 保存字段原始规则，并中止由旧规则启动的运行。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 字段路径。
   * @param rules - 原始规则声明；传 `undefined` 表示移除规则。
   */
  public setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName> | PresetRuleEntry<unknown> | undefined
  ): void {
    if (this.destroyed) return

    const key = createFieldKey(name)

    this.abortRun(key)

    if (rules === undefined) {
      this.fieldRules.delete(key)
    } else {
      this.fieldRules.set(key, {
        name,
        rules: copyFieldRules(rules) as FieldRules<TValues, NamePath<TValues>>,
      })
    }

    this.clearResolvedFieldErrors(name)
  }

  public setManualFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName>
  ): void {
    if (this.destroyed) return

    const key = createFieldKey(name)

    this.abortRun(key)
    this.manualFieldRules.set(key, {
      name,
      rules: copyFieldRules(rules) as FieldRules<TValues, NamePath<TValues>>,
    })
    this.clearResolvedFieldErrors(name)
  }

  /**
   * 只移除字段原始规则；字段元数据和必填校验保持不变。
   *
   * @param name - 字段路径。
   */
  public removeFieldRules(name: NamePath<TValues>): void {
    const key = createFieldKey(name)

    this.abortRun(key)
    this.fieldRules.delete(key)
    this.clearResolvedFieldErrors(name)
  }

  public removeManualFieldRules(name: NamePath<TValues>): void {
    const key = createFieldKey(name)

    this.abortRun(key)
    this.manualFieldRules.delete(key)
    this.clearResolvedFieldErrors(name)
  }

  /**
   * 移除字段元数据和规则、中止正在进行的校验并清除全部错误。
   *
   * @param name - 要移除的字段路径。
   */
  public removeField(name: NamePath<TValues>): void {
    const key = createFieldKey(name)

    this.abortRun(key)
    const config = this.fieldConfigs.get(key)

    if (config && this.manualFieldRules.has(key)) {
      this.fieldConfigs.set(key, { ...config, active: false })
    } else {
      this.fieldConfigs.delete(key)
    }

    this.fieldRules.delete(key)
    this.fieldStore.clearFieldErrors(name)
  }

  /**
   * 清理 FieldArray 结构变化后的过期规则运行结果。
   *
   * 越界字段的配置和规则会被移除；仍在有效范围内且受影响的字段只会中止当前运行。
   *
   * @param path - 发生结构变化的数组字段路径。
   * @param change - 本次数组结构变化描述。
   */
  public invalidateFieldArray(path: NamePath<TValues>, change: FieldArrayChange): void {
    if (this.destroyed) return

    for (const [key, config] of this.fieldConfigs) {
      if (createFieldKey(config.name) === createFieldKey(path)) {
        this.abortRun(key)

        continue
      }

      if (isFieldArrayDescendantOutOfRange(config.name, path, change.nextLength)) {
        this.fieldConfigs.delete(key)
        this.abortRun(key)

        continue
      }

      if (!isFieldArrayDescendantAffected(config.name, path, change)) continue

      this.abortRun(key)
    }

    for (const [key, record] of this.fieldRules) {
      if (createFieldKey(record.name) === createFieldKey(path)) {
        this.abortRun(key)

        continue
      }

      if (isFieldArrayDescendantOutOfRange(record.name, path, change.nextLength)) {
        this.fieldRules.delete(key)
        this.abortRun(key)

        continue
      }

      if (!isFieldArrayDescendantAffected(record.name, path, change)) continue

      this.abortRun(key)
    }

    this.fieldStore.invalidateFieldArrayErrors(path, change)
  }

  /**
   * 按错误来源替换字段问题，并保持其他来源和展示顺序不变。
   *
   * @param name - 要更新的字段路径。
   * @param type - 要替换的错误来源。
   * @param issues - 新的来源问题列表。
   */
  private replaceFieldErrors(
    name: NamePath<TValues>,
    type: ValidationRuleIssue["type"],
    issues: readonly ValidationRuleIssue[]
  ): void {
    type IssueType = NonNullable<ValidationRuleIssue["type"]>

    const grouped: Record<IssueType, ValidationRuleIssue[]> = {
      configuration: [],
      validation: [],
      external: [],
    }

    for (const issue of this.fieldStore.getFieldErrors(name)) {
      const issueType: IssueType = issue.type ?? "validation"

      if (issueType !== type) {
        grouped[issueType].push({ ...issue, type: issueType })
      }
    }

    for (const issue of issues) {
      const issueType: IssueType = type ?? "validation"

      grouped[issueType].push({ ...issue, type: issueType })
    }

    this.fieldStore.setFieldErrors(name, [
      ...grouped.configuration,
      ...grouped.validation,
      ...grouped.external,
    ])
  }

  /**
   * 清除配置解析和规则执行错误，保留 `external` 错误。
   *
   * @param name - 要清理错误的字段路径。
   */
  private clearResolvedFieldErrors(name: NamePath<TValues>): void {
    this.replaceFieldErrors(name, "configuration", [])
    this.replaceFieldErrors(name, "validation", [])
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
    if (this.destroyed) return createValidationCancelled(values)

    // 当前字段的稳定运行身份。
    const key = createFieldKey(name)

    // 唯一允许提交本次状态的运行令牌。
    const run = this.startRun(key)

    // 在运行开始时读取字段元数据和原始规则。
    const config = this.fieldConfigs.get(key)

    const ruleRecord = this.manualFieldRules.get(key) ?? this.fieldRules.get(key)

    const mutationRevision = this.fieldStore.getMutationRevision()

    let rules: readonly ValidationRule[] = []

    if (config?.active === false) {
      this.runs.delete(key)
      this.clearResolvedFieldErrors(name)

      return createValidationSuccess(values)
    }

    if (config || ruleRecord) {
      try {
        rules = this.resolveRules(
          config ?? {
            name,
            label: "",
            placeholder: "",
            required: undefined,
          },
          ruleRecord?.rules
        )
        this.replaceFieldErrors(name, "configuration", [])
      } catch (error) {
        this.runs.delete(key)
        this.replaceFieldErrors(name, "validation", [])
        this.replaceFieldErrors(name, "configuration", [
          {
            type: "configuration",
            message: "字段校验配置错误",
            code: "validation_config",
            cause: error,
          },
        ])
        console.error(`[schemx] 字段 "${String(name)}" 校验配置错误`, error)

        return this.fieldResult(name, values)
      }
    }

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

    if (
      issues === undefined ||
      run.controller.signal.aborted ||
      this.destroyed ||
      this.fieldStore.getMutationRevision() !== mutationRevision
    ) {
      return createValidationCancelled(values)
    }

    if (this.runs.get(key)?.version !== run.version) {
      return createValidationCancelled(values)
    }

    this.runs.delete(key)
    this.replaceFieldErrors(name, "validation", issues)

    return this.fieldResult(name, values)
  }

  /**
   * 并行执行全部已注册字段，并将 external-only 字段纳入最终结果。
   *
   * @param values - 本次运行使用的表单值快照。
   * @returns 成功、失败或任一字段被取消时的取消结果。
   */
  public async validate(values: TValues): Promise<ValidationResult<TValues>> {
    if (this.destroyed) return createValidationCancelled(values)

    const mutationRevision = this.fieldStore.getMutationRevision()

    // 合并配置和规则字段，避免校验期间字段注册变化影响本轮范围。
    const records = this.collectValidationRecords()

    // 各字段独立运行，但限制并发数并在批次间让出主线程。
    const results = await this.validateFieldsInBatches(records, values)

    if (
      results.some((result) => !result.valid && result.cancelled) ||
      this.fieldStore.getMutationRevision() !== mutationRevision
    ) {
      return createValidationCancelled(values)
    }

    // 最终从最新错误仓库读取，避免校验期间写入的 external 错误被旧结果覆盖。
    const errors: ValidationError<NamePath<TValues>>[] = []

    for (const entry of this.fieldStore.getFieldsErrors()) {
      const fieldError = this.createFieldError(entry.field, entry.errors)

      if (fieldError) errors.push(fieldError)
    }

    return errors.length === 0
      ? createValidationSuccess(values)
      : createValidationFailure(values, errors)
  }

  /**
   * 中止全部运行并释放规则与错误状态。
   */
  public destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    for (const run of this.runs.values()) run.controller.abort()
    this.runs.clear()
    this.fieldConfigs.clear()
    this.fieldRules.clear()
    this.manualFieldRules.clear()
    this.fieldStore.clearAllErrors()
  }

  /**
   * 启动字段新运行，并使同字段旧运行进入取消状态。
   *
   * @param key - 字段的稳定路径 key。
   * @returns 新建的字段校验运行。
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
   *
   * @param key - 字段的稳定路径 key。
   */
  private abortRun(key: string): void {
    // 仍可取消的当前字段运行。
    const run = this.runs.get(key)

    if (!run) return

    run.controller.abort()
    this.runs.delete(key)
  }

  /**
   * 将字段原始配置解析为可执行的原生规则。
   *
   * @param config - 字段校验元数据。
   * @param rules - 字段原始规则声明。
   * @returns 当前 Registry 和 adapter 路由下的原生规则列表。
   */
  private resolveRules(
    config: FieldValidationConfig<TValues, NamePath<TValues>>,
    rules: FieldRules<TValues, NamePath<TValues>> | PresetRuleEntry<unknown> | undefined
  ): readonly ValidationRule[] {
    const nativeRules: ValidationRule[] = []

    if (config.required) {
      nativeRules.push(...this.resolveNamedRule("required", config))
    }

    if (typeof rules === "function") {
      const resolved = rules({
        name: config.name,
        label: config.label,
        required: (config.required ?? false) as RequiredConfig<unknown>,
        placeholder: config.placeholder,
      })

      nativeRules.push(...this.resolveObjectRule(resolved, config))

      return nativeRules
    }

    for (const rule of toRuleArray(rules as FieldRules<TValues, NamePath<TValues>>)) {
      nativeRules.push(...this.resolveRule(rule, config))
    }

    return nativeRules
  }

  /**
   * 解析单条字段规则声明。
   *
   * @param rule - 待解析的规则声明。
   * @param config - 当前字段规则配置。
   * @returns 当前规则对应的原生规则列表。
   */
  private resolveRule(
    rule: FieldRule<TValues, NamePath<TValues>>,
    config: FieldValidationConfig<TValues, NamePath<TValues>>
  ): readonly ValidationRule[] {
    if (typeof rule === "string") return this.resolveNamedRule(rule, config)

    return this.resolveObjectRule(rule, config)
  }

  /**
   * 优先解析 Registry 中的命名规则，未注册时再交给 adapter 路由。
   *
   * @param name - 命名规则名称。
   * @param config - 当前字段规则配置。
   * @returns 当前规则对应的原生规则列表。
   */
  private resolveNamedRule(
    name: string,
    config: FieldValidationConfig<TValues, NamePath<TValues>>
  ): readonly ValidationRule[] {
    if (this.presetRuleRegistry.has(name)) {
      const resolved = this.presetRuleRegistry.resolve(name, {
        name: config.name,
        label: config.label,
        required: (config.required ?? false) as RequiredConfig<unknown>,
        placeholder: config.placeholder,
      })

      if (resolved === undefined) {
        throw new Error(`命名校验规则 "${name}" 未返回可执行规则`)
      }

      return this.resolveObjectRule(resolved, config)
    }

    return this.resolveWithAdapter(name, config)
  }

  /**
   * 直接接收原生规则，或将对象规则交给首个匹配的 adapter。
   *
   * @param rule - 待解析的对象规则。
   * @param config - 当前字段规则配置。
   * @returns 当前规则对应的原生规则列表。
   */
  private resolveObjectRule(
    rule: object,
    config: FieldValidationConfig<TValues, NamePath<TValues>>
  ): readonly ValidationRule[] {
    if (isValidationRule(rule)) return [rule]

    return this.resolveWithAdapter(rule, config)
  }

  /**
   * 使用 adapter 解析规则，并校验 adapter 的输出契约。
   *
   * @param rule - 待交给 adapter 的规则声明。
   * @param config - 当前字段规则配置。
   * @returns adapter 生成的原生规则列表。
   */
  private resolveWithAdapter(
    rule: unknown,
    config: FieldValidationConfig<TValues, NamePath<TValues>>
  ): readonly ValidationRule[] {
    const adapter = findValidationAdapter(this.adapters, rule)

    if (!adapter) {
      if (typeof rule === "string") {
        console.warn(`[schemx] 未找到名为 "${rule}" 的校验规则`)
        throw new Error(`未找到名为 "${rule}" 的校验规则`)
      }

      console.warn(`[schemx] 字段 "${String(config.name)}" 存在无法识别的校验规则`)
      throw new Error(`字段 "${String(config.name)}" 存在无法识别的校验规则`)
    }

    const resolved = adapter.resolve(rule as never, {
      name: config.name,
      label: config.label,
    })

    if (
      !Array.isArray(resolved) ||
      resolved.length === 0 ||
      resolved.some((item) => !isValidationRule(item))
    ) {
      throw new Error(
        `字段 "${String(config.name)}" 的 adapter "${String(adapter.id)}" 返回了非法原生校验规则`
      )
    }

    return resolved
  }

  /**
   * 按声明顺序执行字段规则；任何中止都会立即停止后续规则。
   *
   * @typeParam TValue - 规则接收的字段值类型。
   * @typeParam TName - 当前字段路径类型。
   * @param rules - 要按顺序执行的原生规则列表。
   * @param value - 当前字段值；字段不存在时为 `undefined`。
   * @param context - 提供字段路径、表单快照和取消信号的规则上下文。
   * @returns 规则产生的问题列表；运行被取消时返回 `undefined`。
   */
  private async executeRules<TValue, TName extends NamePath<TValues>>(
    rules: readonly ValidationRule<TValue, TValues, TName>[],
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): Promise<readonly ValidationRuleIssue[] | undefined> {
    // 按规则声明顺序累积的完整问题。
    const issues: ValidationRuleIssue[] = []

    let rulesSinceYield = 0

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

        rulesSinceYield += 1

        if (rulesSinceYield >= DEFAULT_RULES_PER_TIME_SLICE) {
          rulesSinceYield = 0
          await yieldToHost()
        }
      } catch (error) {
        if (context.signal.aborted) return undefined
        console.error(`[schemx] 字段 "${String(context.name)}" 校验规则执行错误`, error)
        issues.push(this.getRuleErrorIssue(error, context))
      }
    }

    return issues
  }

  /**
   * 合并字段元数据和原始规则记录，固定本轮校验的字段范围。
   *
   * @returns 按稳定字段顺序排列的校验记录。
   */
  private collectValidationRecords(): FieldRuleRecord<TValues>[] {
    const records = new Map<string, FieldRuleRecord<TValues>>()

    // 只有元数据的字段仍需参与校验，否则动态 required 更新后会被遗漏。
    for (const [key, config] of this.fieldConfigs) {
      records.set(key, { name: config.name, rules: undefined })
    }

    // 规则记录覆盖元数据中的空规则，同时保留稳定的配置插入顺序。
    for (const [key, record] of this.fieldRules) {
      records.set(key, record)
    }

    return [...records.values()]
  }

  /**
   * 以固定并发数执行整表字段校验，避免一次性启动大量规则运行。
   *
   * @param records - 本轮要校验的字段记录。
   * @param values - 本轮运行使用的表单值快照。
   * @returns 各字段校验结果，顺序与 `records` 保持一致。
   */
  private async validateFieldsInBatches(
    records: readonly FieldRuleRecord<TValues>[],
    values: TValues
  ): Promise<ValidationResult<TValues>[]> {
    if (records.length === 0) {
      return []
    }

    const concurrency = normalizeValidationConcurrency(this.options.validationConcurrency)

    const results: ValidationResult<TValues>[] = new Array(records.length)

    let nextIndex = 0

    let fieldsSinceYield = 0

    const runWorker = async (): Promise<void> => {
      while (nextIndex < records.length) {
        const index = nextIndex++

        const record = records[index]

        results[index] = await this.validateField(record.name, values)
        fieldsSinceYield += 1

        if (fieldsSinceYield >= concurrency) {
          fieldsSinceYield = 0
          await yieldToHost()
        }
      }
    }

    const workerCount = Math.min(concurrency, records.length)

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

    return results
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

      return { type: "validation", message, code: "rule_execution", cause: error }
    } catch (handlerError) {
      console.error(
        `[schemx] 字段 "${String(context.name)}" 校验规则错误处理器执行错误`,
        handlerError
      )

      return {
        type: "validation",
        message: "校验执行失败",
        code: "rule_execution",
        cause: handlerError,
      }
    }
  }

  /**
   * 根据当前错误仓库创建字段校验结果。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 错误所属的字段路径。
   * @param values - 本次校验使用的表单值。
   * @returns 当前字段错误；没有错误时返回成功结果。
   */
  private fieldResult<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): ValidationResult<TValues, TName> {
    // 将当前合并错误仓库转换为公开字段错误。
    const fieldError = this.createFieldError(name, this.fieldStore.getFieldErrors(name))

    return fieldError
      ? createValidationFailure(values, [fieldError])
      : createValidationSuccess(values)
  }

  /**
   * 将非空 issue 列表包装为字段错误，空数组返回 `undefined`。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 错误所属的字段路径。
   * @param issues - 要包装的字段问题列表。
   * @returns 字段级错误；问题列表为空时返回 `undefined`。
   */
  private createFieldError<TName extends NamePath<TValues>>(
    name: TName,
    issues: readonly ValidationRuleIssue[]
  ): FieldValidationError<TName> | undefined {
    const [first, ...rest] = issues

    if (first === undefined) return undefined

    return { scope: "field", name, issues: [first, ...rest] }
  }
}

/**
 * 将单条或多条字段规则声明统一为数组。
 *
 * @param rules - 字段的原始规则声明。
 * @returns 可按声明顺序遍历的规则列表。
 */
function toRuleArray<TValues extends Values, TName extends NamePath<TValues>>(
  rules: FieldRules<TValues, TName> | undefined
): readonly FieldRule<TValues, TName>[] {
  if (rules === undefined) return []

  if (Array.isArray(rules)) {
    return rules as readonly FieldRule<TValues, TName>[]
  }

  return [rules as FieldRule<TValues, TName>]
}

/**
 * 复制字段规则数组，避免调用方后续修改配置集合。
 *
 * @param rules - 字段的原始规则声明。
 * @returns 与输入语义相同的独立规则声明。
 */
function copyFieldRules<TValues extends Values, TName extends NamePath<TValues>>(
  rules: FieldRules<TValues, TName> | PresetRuleEntry<unknown> | undefined
): FieldRules<TValues, TName> | PresetRuleEntry<unknown> | undefined {
  if (rules === undefined || !Array.isArray(rules)) return rules

  return [...rules] as readonly FieldRule<TValues, TName>[]
}

/**
 * 判断值是否为可执行的原生校验规则。
 *
 * @param value - 待检查的规则值。
 * @returns 值是否包含可执行的 validate 函数。
 */
function isValidationRule(value: unknown): value is ValidationRule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ValidationRule).validate === "function"
  )
}

/**
 * 判断未知返回值是否满足运行时规则结果契约。
 *
 * @param value - 规则返回的未知值。
 * @returns 值是否包含合法的成功或失败结果。
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
 * 创建 Core 内部字段校验器。
 *
 * 仅供 `FormModel` 装配使用，不从 `@schemx/core` 根入口导出。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 规则异常映射等执行选项。
 * @returns 管理规则、错误和异步运行生命周期的 Validator。
 *
 * @internal
 *
 * @example
 * ```ts
 * const validator = createValidator({ fieldStore, presetRuleRegistry })
 * validator.setFieldConfig(fieldConfig)
 * ```
 */
export function createValidator<TValues extends Values = Values>(
  options: CreateValidatorOptions<TValues>
): Validator<TValues> {
  return new ValidatorImpl(options)
}

/**
 * 将校验并发数归一为正整数。
 *
 * @param value - 调用方配置的并发数。
 * @returns 不小于 `1` 的有限整数；未配置或无效时返回默认值。
 */
function normalizeValidationConcurrency(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_VALIDATION_CONCURRENCY
  }

  return Math.max(1, Math.floor(value))
}

export type {
  ValidationCancelled,
  ValidationError,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  Validator,
} from "./types"
