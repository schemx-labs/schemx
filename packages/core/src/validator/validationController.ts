import { createFieldKey } from "../utils"

import { createValidationAdapterMap, findValidationAdapter } from "./adapters"
import { createRequiredValidationRule } from "./rules"

import type {
  ValidationAdapter,
  ValidationAdapterID,
  ValidationAdapterOption,
  ValidationRule,
  Validator,
} from "./types"
import type {
  ValidationRuleRegistry,
  ValidationRuleRegistryChange,
} from "../registry/validationRuleRegistry"
import type { NamePath, Values } from "../types/form"
import type {
  DefinedFieldValue,
  FieldRule,
  FieldRules,
  RequiredRule,
} from "../types/rule"

/**
 * 解析后的单条原生校验规则，按字段路径推导值类型。
 */
type ResolvedValidationRule<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>

/**
 * 同步单个字段校验规则时所需的字段配置。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段路径。
 */
export interface FieldValidationConfig<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 要同步的字段路径。
   */
  readonly name: TName
  /**
   * 用于生成默认错误消息及命名规则工厂的字段标签。
   */
  readonly label: string
  /**
   * 字段的必填声明；存在时会先归一化为 required 规则。
   */
  readonly required: RequiredRule<DefinedFieldValue<TValues, TName>> | undefined
  /**
   * 额外规则声明。
   *
   * 未注册的命名规则会使同步失败，并在开发期对每个规则名仅发出一次警告。
   */
  readonly rules: FieldRules<TValues, TName> | undefined
}

/**
 * 将 Schema 字段配置归一化为 Validator 可执行规则的协调器。
 *
 * 内部持有 adapter 映射（内置 Standard Schema adapter + 用户 adapter），统一解析
 * 命名规则、品牌 adapter 规则、Standard Schema 与原生规则。解析失败会写入
 * `validation_config` 问题，避免字段在配置错误时被静默视为通过。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * controller.syncField({
 *   name: "email",
 *   label: "邮箱",
 *   required: true,
 *   rules: ["email"],
 * })
 * ```
 */
export interface ValidationController<TValues extends Values> {
  /**
   * 归一化并替换一个字段的全部校验规则。
   *
   * @typeParam TName - 字段路径。
   * @param config - 已解析的字段必填和规则配置。
   * @returns 配置是否已成功解析；失败时字段会保留 `validation_config` 问题。
   *
   * @remarks
   * 未注册命名规则、无法识别对象、adapter 歧义和 adapter 非法输出都会使配置失败关闭。
   */
  syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean
  /**
   * 移除字段规则及其已有错误消息。
   *
   * @param name - 要移除的字段路径。
   */
  removeField(name: NamePath<TValues>): void
  /**
   * 取消 Registry 订阅并清除 Controller 持有的字段配置索引。
   */
  destroy(): void
}

/**
 * 创建 ValidationController 所需的协作对象。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateValidationControllerOptions<TValues extends Values> {
  /**
   * 接收归一化字段规则和错误状态操作的校验器。
   */
  readonly validator: Validator<TValues>
  /**
   * 用于解析 `rules` 中命名规则的注册中心。
   */
  readonly registry: ValidationRuleRegistry
  /**
   * 当前 Form 固定使用的校验 adapter 注册项。
   *
   * Standard Schema 由唯一内置 adapter 始终支持；原生 `ValidationRule` 是 Core
   * 基础规则类型，二者均无需在此注册。
   */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]
}

/**
 * 保存字段配置并协调 Registry、adapter 与 Validator 的内部实现。
 */
class ValidationControllerImpl<
  TValues extends Values,
> implements ValidationController<TValues> {
  // 已警告的缺失命名规则，防止重复同步时刷屏。
  private readonly warnedUnknownRules = new Set<string>()
  // 已警告的无法识别字段，按稳定字段身份去重。
  private readonly warnedUnrecognizedFields = new Set<string>()
  // 内置与用户 adapter 按唯一 id 建立的只读路由表。
  private readonly adapters: ReadonlyMap<ValidationAdapterID, ValidationAdapter>
  // 供动态 Registry 变更重新解析的原始字段配置。
  private readonly configs = new Map<
    string,
    FieldValidationConfig<TValues, NamePath<TValues>>
  >()
  // 从命名规则反查受影响字段的索引。
  private readonly fieldsByRuleName = new Map<string, Set<string>>()
  // 销毁时释放 Registry 订阅的函数。
  private readonly unsubscribeRegistry: () => void

  /**
   * 创建控制器并订阅命名规则注册表的变更。
   *
   * @param options - Validator、Registry 和 adapter 注册配置。
   */
  public constructor(
    private readonly options: CreateValidationControllerOptions<TValues>
  ) {
    this.adapters = createValidationAdapterMap(options.validatorAdapters ?? [])

    this.unsubscribeRegistry = options.registry.subscribe((change) => {
      this.syncAffectedFields(change)
    })
  }

  /**
   * 归一化并替换一个字段的全部校验规则。
   *
   * @typeParam TName - 字段路径。
   * @param config - 已解析的字段必填和规则配置。
   */
  public syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean {
    // 擦除窄路径类型后保存，用于后续动态重同步。
    const storedConfig = config as FieldValidationConfig<TValues, NamePath<TValues>>

    this.trackConfig(storedConfig)

    try {
      // 在替换 Validator 规则前完成全量解析，避免部分规则泄漏。
      const rules = this.normalizeRules(config)

      this.options.validator.clearFieldConfigurationIssues(config.name)
      this.options.validator.setFieldRules(config.name, rules)

      return true
    } catch (error) {
      this.options.validator.setFieldRules(config.name, [])
      this.options.validator.setFieldConfigurationIssues(config.name, [
        {
          message: "字段校验配置错误",
          code: "validation_config",
          cause: error,
        },
      ])

      return false
    }
  }

  /**
   * 移除字段规则及其已有错误消息。
   *
   * @param name - 要移除的字段路径。
   */
  public removeField(name: NamePath<TValues>): void {
    this.untrackConfig(name)
    this.options.validator.removeFieldRules(name)
  }

  /**
   * 取消动态 Registry 订阅并释放所有字段反向索引。
   */
  public destroy(): void {
    this.unsubscribeRegistry()
    this.configs.clear()
    this.fieldsByRuleName.clear()
  }

  /**
   * 将 required 与字段额外规则合并为可执行规则列表。
   *
   * @param config - 待归一化的字段配置。
   * @returns 按声明顺序排列的原生规则列表。
   */
  private normalizeRules<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // required 规则与额外规则合并后的执行列表。
    const normalized: ResolvedValidationRule<TValues, TName>[] = []

    if (config.required) {
      normalized.push(
        createRequiredValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>({
          required: config.required,
          label: config.label,
        })
      )
    }

    for (const rule of toRuleArray(config.rules)) {
      normalized.push(...this.resolveRule(rule, config))
    }

    return normalized
  }

  /**
   * 将单条字段规则分派到命名规则或对象规则解析流程。
   *
   * @param rule - 待解析的字段规则。
   * @param config - 当前字段配置。
   * @returns 解析后的原生规则列表。
   */
  private resolveRule<TName extends NamePath<TValues>>(
    rule: FieldRule<TValues, TName>,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    if (typeof rule === "string") return this.resolveNamedRule(rule, config)

    return this.resolveObjectRule(rule, config)
  }

  /**
   * 通过 Registry 解析命名规则，并继续解析其返回值。
   *
   * @param name - Registry 中的规则名称。
   * @param config - 当前字段配置。
   * @returns 解析后的原生规则列表。
   * @throws 当 Registry 中不存在该名称时抛出错误。
   */
  private resolveNamedRule<TName extends NamePath<TValues>>(
    name: string,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // 使用字段元数据延迟解析命名规则工厂。
    const rule = this.options.registry.resolve(name, {
      name: config.name,
      label: config.label,
      required: Boolean(config.required),
    })

    if (!rule) {
      this.warnUnknownRule(name)
      throw new Error(`未找到名为 "${name}" 的校验规则`)
    }

    // 注册表解析结果可能是 Standard Schema 或原生规则，统一交由规则解析逻辑识别。
    return this.resolveObjectRule(rule, config)
  }

  /**
   * 识别原生规则或路由到唯一匹配的 adapter。
   *
   * @param rule - 待解析的对象规则。
   * @param config - 当前字段配置。
   * @returns 解析后的原生规则列表。
   * @throws 当规则无法识别或命中多个 adapter 时抛出错误。
   */
  private resolveObjectRule<TName extends NamePath<TValues>>(
    rule: object,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // 原生规则是 Validator 的基础输入，不参与 adapter 路由。
    if (isValidationRule(rule)) return [rule]

    // 每条对象规则必须恰好命中一个 adapter。
    const adapter = findValidationAdapter(this.adapters, rule)

    if (adapter) return this.resolveAdapterRule(adapter, rule, config)

    this.warnUnrecognizedObjectRule(config.name)
    throw new Error(`字段 "${String(config.name)}" 存在无法识别的校验规则`)
  }

  /**
   * 执行 adapter 解析，并校验其返回的原生规则契约。
   *
   * @param adapter - 命中的规则 adapter。
   * @param rule - adapter 接收的原始规则。
   * @param config - 当前字段配置。
   * @returns adapter 生成的原生规则列表。
   * @throws 当 adapter 返回非法规则列表时抛出错误。
   */
  private resolveAdapterRule<TName extends NamePath<TValues>>(
    adapter: ValidationAdapter,
    rule: unknown,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // adapter 输出仍需做运行时形状校验，不能信任第三方实现。
    const resolved = adapter.resolve<DefinedFieldValue<TValues, TName>>(
      rule as never,
      config
    )

    if (
      !Array.isArray(resolved) ||
      resolved.length === 0 ||
      resolved.some((item) => !isValidationRule(item))
    ) {
      throw new Error(
        `字段 "${String(config.name)}" 的 adapter "${String(adapter.id)}" 返回了非法原生校验规则`
      )
    }

    return resolved as readonly ResolvedValidationRule<TValues, TName>[]
  }

  /**
   * 对未注册命名规则发出一次开发期警告。
   *
   * @param name - 未找到的规则名称。
   */
  private warnUnknownRule(name: string): void {
    if (this.warnedUnknownRules.has(name)) return

    this.warnedUnknownRules.add(name)
    console.warn(`[schemx] 未找到名为 "${name}" 的校验规则`)
  }

  /**
   * 对无法识别的对象规则按字段发出一次开发期警告。
   *
   * @param name - 无法识别规则的字段路径。
   */
  private warnUnrecognizedObjectRule(name: NamePath<TValues>): void {
    // 仅用于警告去重的展示路径。
    const key = createFieldKey(name)

    if (this.warnedUnrecognizedFields.has(key)) return

    this.warnedUnrecognizedFields.add(key)
    console.warn(`[schemx] 字段 "${String(name)}" 存在无法识别的校验规则，配置失败`)
  }

  /**
   * 记录字段配置及其引用的命名规则，供 Registry 变更精确重同步。
   */
  private trackConfig(config: FieldValidationConfig<TValues, NamePath<TValues>>): void {
    this.untrackConfig(config.name)

    // 反向索引使用与 Validator 一致的稳定字段身份。
    const key = createFieldKey(config.name)

    // 只有字符串规则名会受 Registry 事件影响。
    const ruleNames = getRuleNames(config.rules)

    this.configs.set(key, config)

    for (const ruleName of ruleNames) {
      // 同名规则可被多个字段引用。
      const fields = this.fieldsByRuleName.get(ruleName) ?? new Set<string>()

      fields.add(key)
      this.fieldsByRuleName.set(ruleName, fields)
    }
  }

  /**
   * 移除字段配置及其所有命名规则反向索引。
   */
  private untrackConfig(name: NamePath<TValues>): void {
    // 根据稳定身份找到字段此前注册的配置，并重新提取命名规则。
    const key = createFieldKey(name)

    const ruleNames = getRuleNames(this.configs.get(key)?.rules)

    for (const ruleName of ruleNames) {
      // 规则名对应的受影响字段集合。
      const fields = this.fieldsByRuleName.get(ruleName)

      if (!fields) continue
      fields.delete(key)
      if (fields.size === 0) this.fieldsByRuleName.delete(ruleName)
    }

    this.configs.delete(key)
  }

  /**
   * 根据 Registry 变更仅重新同步引用受影响规则名的字段。
   */
  private syncAffectedFields(change: ValidationRuleRegistryChange): void {
    // 由变更规则名收集的去重字段集合。
    const affected = new Set<string>()

    for (const name of change.names) {
      for (const key of this.fieldsByRuleName.get(name) ?? []) affected.add(key)
    }

    for (const key of affected) {
      // 字段仍存在时才基于最新 Registry 重新解析。
      const config = this.configs.get(key)

      if (config) this.syncField(config)
    }
  }
}

/**
 * 将字段规则声明统一为数组，供顺序归一化使用。
 */
function toRuleArray<TValues extends Values, TName extends NamePath<TValues>>(
  rules: FieldRules<TValues, TName> | undefined
): readonly FieldRule<TValues, TName>[] {
  if (!rules) return []

  return (Array.isArray(rules) ? rules : [rules]) as readonly FieldRule<TValues, TName>[]
}

/**
 * 从字段规则中提取会受 Registry 变更影响的命名规则。
 *
 * @param rules - 待扫描的字段规则声明。
 * @returns 按原始顺序收集的命名规则列表。
 */
function getRuleNames<TValues extends Values, TName extends NamePath<TValues>>(
  rules: FieldRules<TValues, TName> | undefined
): readonly string[] {
  return toRuleArray(rules).filter(
    (rule): rule is Extract<typeof rule, string> => typeof rule === "string"
  )
}

/**
 * 判断值是否为可执行的原生校验规则（含 `validate` 函数）。
 *
 * @param value - 待检查的未知值。
 * @returns 值是否符合原生校验规则的最小运行时形状。
 */
function isValidationRule(value: unknown): value is ValidationRule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ValidationRule).validate === "function"
  )
}

/**
 * 创建字段校验配置控制器。
 *
 * 控制器将 `required`、命名规则、原生规则、Standard Schema 和 adapter 规则统一为
 * Validator 的原生规则；唯一内置 adapter 处理 Standard Schema，用户 adapter 在创建时
 * 与它一起去重固化。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Validator、命名规则注册中心与用户 adapter 注册项。
 * @returns 用于同步或移除字段校验配置的控制器。
 *
 * @example
 * ```ts
 * const controller = createValidationController({ validator, registry })
 * controller.syncField({ name: "email", label: "邮箱", required: true, rules: "email" })
 * ```
 */
export function createValidationController<TValues extends Values = Values>(
  options: CreateValidationControllerOptions<TValues>
): ValidationController<TValues> {
  return new ValidationControllerImpl(options)
}
