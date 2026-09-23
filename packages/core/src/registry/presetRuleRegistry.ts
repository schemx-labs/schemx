import { createRequiredValidationRule } from "../validator/built-in.rules"

import type { RegistryOptions } from "./types"
import type { AsyncValidatorDescriptor } from "../types/asyncValidator"
import type { PresetRuleDefinition, RequiredConfig } from "../types/rule"
import type { StandardSchemaV1 } from "../types/standardSchema"
import type { ValidationRule } from "../validator/types"

/**
 * 从声明合并的规则定义中提取规则名称。
 */
type DeclaredPresetRuleName = Extract<keyof PresetRuleDefinition, string>

/**
 * 在存在声明规则与否的两种模式间选择规则 key 类型。
 */
type PresetRuleKey = [DeclaredPresetRuleName] extends [never]
  ? string
  : DeclaredPresetRuleName | "required"

/**
 * 根据规则名称映射到对应的字段值类型。
 */
type PresetRuleValue<TKey extends PresetRuleKey> = TKey extends DeclaredPresetRuleName
  ? PresetRuleDefinition[TKey]
  : unknown

/**
 * 规则注册表中已经解析、可直接执行的规则条目。
 */
type ResolvedPresetRuleEntry<TValue> =
  ValidationRule<TValue> | StandardSchemaV1<TValue, unknown> | AsyncValidatorDescriptor

/**
 * 命名规则工厂可读取的字段元数据。
 *
 * @typeParam TName - 字段路径类型。
 * @typeParam TFieldValue - 字段值类型，用于约束 required 配置。
 *
 * @example
 * ```ts
 * const factory = (context: PresetRuleFactoryContext) =>
 *   context.required ? requiredRule : optionalRule
 * ```
 */
export interface PresetRuleFactoryContext<
  TName extends PropertyKey = string,
  TFieldValue = unknown,
> {
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
  readonly required: RequiredConfig<TFieldValue>
  /**
   * 用于规则提示的字段占位文本。
   */
  readonly placeholder: string
}

/**
 * 按字段元数据延迟创建命名规则的工厂。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 *
 * @example
 * ```ts
 * const minLength: PresetRuleFactory<string> = ({ label }) => ({
 *   validate: (value) => value.length >= 8
 *     ? { valid: true }
 *     : {
 *         valid: false,
 *         issues: [{ type: "validation", message: `${label}至少需要 8 个字符` }],
 *       },
 * })
 * ```
 */
export type PresetRuleFactory<TValue = unknown> = {
  /**
   * 根据字段元数据创建规则。
   *
   * @typeParam TName - 字段路径类型。
   * @param context - 当前字段的路径、标签、占位文本和必填配置。
   * @returns 可供 Validator 执行的原生规则或 Standard Schema。
   */
  <TName extends PropertyKey>(
    context: PresetRuleFactoryContext<TName>
  ): ResolvedPresetRuleEntry<TValue>
}

/**
 * 命名规则的注册条目，可直接提供规则或延迟创建规则的工厂。
 *
 * @typeParam TValue - 规则接收的字段值类型。
 */
export type PresetRuleEntry<TValue = unknown> =
  ResolvedPresetRuleEntry<TValue> | PresetRuleFactory<TValue>

/**
 * 命名规则名称到注册条目的映射。
 *
 * @example
 * ```ts
 * registry.registerAll({ email: emailRule, password: passwordFactory })
 * ```
 */
export type PresetRuleMap = [DeclaredPresetRuleName] extends [never]
  ? Record<string, PresetRuleEntry<unknown>>
  : {
      [TKey in DeclaredPresetRuleName]: PresetRuleEntry<PresetRuleDefinition[TKey]>
    }

/**
 * 命名规则注册表的变更事件。
 */
export interface PresetRuleRegistryChange {
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
 *
 * @param change - 发生变化的操作类型和受影响规则名称。
 *
 * @example
 * ```ts
 * const listener: PresetRuleRegistryListener = (change) => {
 *   console.log(change.type, change.names)
 * }
 * ```
 */
export type PresetRuleRegistryListener = (change: PresetRuleRegistryChange) => void

/** 由 {@link createPresetRuleRegistry} 创建的预设规则注册表公开 API。 */
export interface PresetRuleRegistry {
  register<TKey extends PresetRuleKey>(
    name: TKey,
    rule: PresetRuleEntry<PresetRuleValue<TKey>>,
    options?: RegistryOptions
  ): void
  registerAll(rules: PresetRuleMap): void
  unregister(name: string): boolean
  get<TKey extends PresetRuleKey>(
    name: TKey
  ): PresetRuleEntry<PresetRuleValue<TKey>> | undefined
  resolve<TName extends PropertyKey>(
    name: string,
    context: PresetRuleFactoryContext<TName>
  ): ResolvedPresetRuleEntry<unknown> | undefined
  has(name: string): boolean
  keys(): PresetRuleKey[]
  clear(): void
  size(): number
  subscribe(listener: PresetRuleRegistryListener): () => void
}

/**
 * 命名校验规则注册中心。
 *
 * 保存用户注册的命名规则和内置 `required` 规则。
 *
 * @example
 * ```ts
 * const registry = createPresetRuleRegistry()
 * registry.register("email", emailRule)
 * ```
 */
class PresetRuleRegistryImpl implements PresetRuleRegistry {
  /**
   * 保存规则名称到原始注册条目的映射。
   */
  private readonly rules = new Map<string, PresetRuleEntry<unknown>>()
  /**
   * 保存规则注册表变更监听器。
   */
  private readonly listeners = new Set<PresetRuleRegistryListener>()

  /**
   * 创建包含内置 required 规则的命名规则注册中心。
   */
  public constructor() {
    this.register("required" as never, createRequiredValidationRule as never)
  }

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
  register<TKey extends PresetRuleKey>(
    name: TKey,
    rule: PresetRuleEntry<PresetRuleValue<TKey>>,
    options?: RegistryOptions
  ): void {
    if (this.rules.has(name) && options?.override === false) {
      console.warn(`[schemx] 校验规则 "${name}" 已存在，跳过注册`)

      return
    }

    this.rules.set(name, rule as PresetRuleEntry<unknown>)
    this.emit({ type: "set", names: [name] })
  }

  /**
   * 批量注册命名校验规则，已有同名规则会被覆盖。
   *
   * @param rules - 名称到规则或规则工厂的映射。
   *
   * @example
   * ```ts
   * registry.registerAll({
   *   email: emailRule,
   *   password: passwordRule,
   * })
   * ```
   */
  registerAll(rules: PresetRuleMap): void {
    for (const [name, rule] of Object.entries(rules)) {
      this.rules.set(name, rule)
    }

    this.emit({ type: "set", names: Object.keys(rules) })
  }

  /**
   * 移除命名规则。
   *
   * @param name - 要移除的规则名称。
   * @returns 该规则是否曾存在。
   *
   * @example
   * ```ts
   * registry.unregister("email") // => true
   * ```
   */
  unregister(name: string): boolean {
    const deleted = this.rules.delete(name)

    if (deleted) this.emit({ type: "delete", names: [name] })

    return deleted
  }

  /**
   * 获取原始注册条目，不会执行规则工厂。
   *
   * @typeParam TKey - 规则名称。
   * @param name - 要读取的规则名称。
   * @returns 注册条目；未注册时返回 `undefined`。
   *
   * @example
   * ```ts
   * const emailRule = registry.get("email")
   * ```
   */
  get<TKey extends PresetRuleKey>(
    name: TKey
  ): PresetRuleEntry<PresetRuleValue<TKey>> | undefined {
    return this.rules.get(name) as PresetRuleEntry<PresetRuleValue<TKey>> | undefined
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
   *
   * @example
   * ```ts
   * const rule = registry.resolve("email", {
   *   name: "email",
   *   label: "邮箱",
   *   required: true,
   *   placeholder: "请输入邮箱",
   * })
   * ```
   */
  resolve<TName extends PropertyKey>(
    name: string,
    context: PresetRuleFactoryContext<TName>
  ): ResolvedPresetRuleEntry<unknown> | undefined {
    const rule = this.rules.get(name)

    if (!rule) return undefined

    return typeof rule === "function" ? rule(context) : rule
  }

  /**
   * 判断名称是否已注册。
   *
   * @param name - 要查询的规则名称。
   * @returns 名称是否存在于注册中心。
   *
   * @example
   * ```ts
   * registry.has("email") // => true
   * ```
   */
  has(name: string): boolean {
    return this.rules.has(name)
  }

  /**
   * 返回当前已注册的规则名称快照。
   *
   * @returns 不会随注册中心后续变化而改变的名称数组。
   *
   * @example
   * ```ts
   * const names = registry.keys()
   * ```
   */
  keys(): PresetRuleKey[] {
    return Array.from(this.rules.keys()) as PresetRuleKey[]
  }

  /**
   * 清空全部命名规则。
   *
   * @example
   * ```ts
   * registry.clear()
   * ```
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
   *
   * @example
   * ```ts
   * const count = registry.size()
   * ```
   */
  size(): number {
    return this.rules.size
  }

  /**
   * 订阅规则注册、覆盖、注销和清空事件。
   *
   * @param listener - 接收变更快照的监听函数。
   * @returns 取消订阅的函数；可重复调用。
   *
   * @example
   * ```ts
   * const unsubscribe = registry.subscribe((change) => {
   *   console.log(change.type, change.names)
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribe(listener: PresetRuleRegistryListener): () => void {
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
  private emit(change: PresetRuleRegistryChange): void {
    for (const listener of [...this.listeners]) listener(change)
  }
}

/**
 * 创建包含内置 required 规则的命名校验规则注册中心。
 *
 * @returns 新建且已注册内置 required 规则的注册中心。
 *
 * @example
 * ```ts
 * const registry = createPresetRuleRegistry()
 * registry.register("email", emailRule)
 * ```
 */
export function createPresetRuleRegistry(): PresetRuleRegistry {
  return new PresetRuleRegistryImpl()
}
