import type { RegistryOptions } from "./types"
import type { ValidationRuleDefinition } from "../types/rule"
import type { StandardSchemaV1 } from "../types/standardSchema"
import type { ValidationRule } from "../validator/types"

type DeclaredValidationRuleName = Extract<keyof ValidationRuleDefinition, string>

type ValidationRuleKey = [DeclaredValidationRuleName] extends [never]
  ? string
  : DeclaredValidationRuleName

type ValidationRuleValue<TKey extends ValidationRuleKey> =
  TKey extends DeclaredValidationRuleName ? ValidationRuleDefinition[TKey] : unknown

type ResolvedValidationRuleEntry<TValue> =
  StandardSchemaV1<TValue, unknown> | ValidationRule<TValue>

/**
 * 命名规则工厂可读取的字段元数据。
 *
 * @typeParam TName - 字段路径类型。
 *
 * @example
 * ```ts
 * const factory = (context: ValidationRuleFactoryContext) =>
 *   context.required ? requiredRule : optionalRule
 * ```
 */
export interface ValidationRuleFactoryContext<TName extends PropertyKey = string> {
  /**
   * 要创建规则的字段路径。
   */
  readonly name: TName
  /**
   * 用于生成面向用户错误消息的字段标签。
   */
  readonly label: string
  /**
   * 字段是否已声明为必填。
   */
  readonly required: boolean
}

/**
 * 按字段元数据延迟创建命名规则的工厂。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 *
 * @example
 * ```ts
 * const minLength: ValidationRuleFactory<string> = ({ label }) => ({
 *   validate: (value) => value.length >= 8
 *     ? { valid: true }
 *     : { valid: false, issues: [{ message: `${label}至少需要 8 个字符` }] },
 * })
 * ```
 */
export type ValidationRuleFactory<TValue = unknown> = {
  /**
   * 根据字段元数据创建规则。
   *
   * @typeParam TName - 字段路径类型。
   * @param context - 当前字段的路径、标签和必填状态。
   * @returns 可供 Validator 执行的原生规则或 Standard Schema。
   */
  <TName extends PropertyKey>(
    context: ValidationRuleFactoryContext<TName>
  ): ResolvedValidationRuleEntry<TValue>
}

/**
 * 命名规则的注册条目，可直接提供规则或延迟创建规则的工厂。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 */
export type ValidationRuleEntry<TValue = unknown> =
  ResolvedValidationRuleEntry<TValue> | ValidationRuleFactory<TValue>

/**
 * 命名规则名称到注册条目的映射。
 *
 * @example
 * ```ts
 * registry.registerAll({ email: emailRule, password: passwordFactory })
 * ```
 */
export type ValidationRuleMap = [DeclaredValidationRuleName] extends [never]
  ? Record<string, ValidationRuleEntry<unknown>>
  : {
      [TKey in DeclaredValidationRuleName]: ValidationRuleEntry<
        ValidationRuleDefinition[TKey]
      >
    }

/**
 * 命名规则注册表的变更事件。
 */
export interface ValidationRuleRegistryChange {
  /**
   * 发生变化的操作类型。
   */
  readonly type: "set" | "delete" | "clear"
  /**
   * 受影响的规则名；clear 事件包含清空前的全部名称。
   */
  readonly names: readonly string[]
}

/**
 * 订阅注册表变化的监听函数。
 */
export type ValidationRuleRegistryListener = (
  change: ValidationRuleRegistryChange
) => void

/**
 * 命名校验规则注册中心。
 *
 * 只保存用户注册的命名规则；`required` 由 ValidationController 单独归一化，
 * 不会作为内置规则写入注册表。
 *
 * @example
 * ```ts
 * const registry = new ValidationRuleRegistry()
 * registry.register("email", emailRule)
 * ```
 */
export class ValidationRuleRegistry {
  private readonly rules = new Map<string, ValidationRuleEntry<unknown>>()
  private readonly listeners = new Set<ValidationRuleRegistryListener>()

  /**
   * 创建一个空的命名规则注册中心。
   */
  public constructor() {}

  /**
   * 注册一个命名校验规则。
   *
   * @typeParam TKey - 已声明的规则名称及其关联值类型。
   * @param name - 规则名称。
   * @param rule - 原生规则、Standard Schema 或规则工厂。
   * @param options - 同名规则的覆盖策略。
   *
   * @example
   * ```ts
   * registry.register("email", emailRule)
   * ```
   */
  register<TKey extends ValidationRuleKey>(
    name: TKey,
    rule: ValidationRuleEntry<ValidationRuleValue<TKey>>,
    options?: RegistryOptions
  ): void {
    if (this.rules.has(name) && options?.override === false) {
      console.warn(`[ValidationRuleRegistry] Rule "${name}" 已存在，跳过注册`)

      return
    }

    this.rules.set(name, rule as ValidationRuleEntry<unknown>)
    this.emit({ type: "set", names: [name] })
  }

  /**
   * 批量注册命名校验规则，已有同名规则会被覆盖。
   *
   * @param rules - 名称到规则或规则工厂的映射。
   */
  registerAll(rules: ValidationRuleMap): void {
    for (const [name, rule] of Object.entries(rules)) {
      this.rules.set(name, rule)
    }

    this.emit({ type: "set", names: Object.keys(rules) })
  }

  /**
   * 获取原始注册条目，不会执行规则工厂。
   *
   * @typeParam TKey - 规则名称。
   * @param name - 要读取的规则名称。
   * @returns 注册条目；未注册时返回 `undefined`。
   */
  get<TKey extends ValidationRuleKey>(
    name: TKey
  ): ValidationRuleEntry<ValidationRuleValue<TKey>> | undefined {
    return this.rules.get(name) as
      ValidationRuleEntry<ValidationRuleValue<TKey>> | undefined
  }

  /**
   * 按字段上下文解析命名规则。
   *
   * 若条目是规则工厂，会在此处调用工厂。
   *
   * @typeParam TName - 字段路径类型。
   * @param name - 要解析的规则名称。
   * @param context - 提供给规则工厂的字段元数据。
   * @returns 已解析的规则；未注册时返回 `undefined`。
   */
  resolve<TName extends PropertyKey>(
    name: string,
    context: ValidationRuleFactoryContext<TName>
  ): ResolvedValidationRuleEntry<unknown> | undefined {
    const rule = this.rules.get(name)

    if (!rule) return undefined

    return typeof rule === "function" ? rule(context) : rule
  }

  /**
   * 判断名称是否已注册。
   *
   * @param name - 要查询的规则名称。
   * @returns 名称是否存在于注册中心。
   */
  has(name: string): boolean {
    return this.rules.has(name)
  }

  /**
   * 移除命名规则。
   *
   * @param name - 要移除的规则名称。
   * @returns 该规则是否曾存在。
   */
  unregister(name: string): boolean {
    const deleted = this.rules.delete(name)

    if (deleted) this.emit({ type: "delete", names: [name] })

    return deleted
  }

  /**
   * 返回当前已注册的规则名称快照。
   *
   * @returns 不会随注册中心后续变化而改变的名称数组。
   */
  keys(): ValidationRuleKey[] {
    return Array.from(this.rules.keys()) as ValidationRuleKey[]
  }

  /**
   * 清空全部命名规则。
   */
  clear(): void {
    const names = [...this.rules.keys()]

    this.rules.clear()
    if (names.length > 0) this.emit({ type: "clear", names })
  }

  /**
   * 返回当前规则数量。
   *
   * @returns 已注册规则的数量。
   */
  size(): number {
    return this.rules.size
  }

  /**
   * 订阅规则注册、覆盖、注销和清空事件。
   *
   * @param listener - 接收变更快照的监听函数。
   * @returns 取消订阅的函数；可重复调用。
   */
  subscribe(listener: ValidationRuleRegistryListener): () => void {
    this.listeners.add(listener)
    let active = true

    return () => {
      if (!active) return
      active = false
      this.listeners.delete(listener)
    }
  }

  /**
   * 向订阅者广播已完成的注册表变更。
   */
  private emit(change: ValidationRuleRegistryChange): void {
    for (const listener of [...this.listeners]) listener(change)
  }
}

/**
 * 创建空的命名校验规则注册中心。
 *
 * @returns 新建且尚未注册任何规则的注册中心。
 *
 * @example
 * ```ts
 * const registry = createValidationRuleRegistry()
 * registry.register("email", emailRule)
 * ```
 */
export function createValidationRuleRegistry(): ValidationRuleRegistry {
  return new ValidationRuleRegistry()
}
