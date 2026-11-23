/**
 * Validators 校验注册中心。
 *
 * 管理 validators 名称到 StandardSchemaV1 实例或规则工厂的映射。
 * 字段 schema 中的字符串规则会在这里解析为可执行的 Standard Schema。
 *
 * @module core/registry/validatorRegistry
 *
 * @example
 * ```typescript
 * import { createValidatorsRegistry, type ValidatorsEntryMap } from '@schemx/core'
 * import { z } from 'zod'
 *
 * const validatorRegistry = createValidatorsRegistry()
 *
 * // 注册固定的 Standard Schema
 * validatorRegistry.register('phone', z.string().regex(/^1\d{10}$/))
 * validatorRegistry.register('email', z.string().email())
 *
 * // 注册工厂函数（接收 schema 参数）
 * validatorRegistry.register('required', (schema) => {
 *   return z.string().min(1, `${schema?.label}为必填项`)
 * })
 *
 * // 批量注册
 * const validators: ValidatorsEntryMap = {
 *   min10: z.string().min(10),
 *   max100: z.string().max(100)
 * }
 * validatorRegistry.registerAll(validators)
 *
 * // 获取原始注册项
 * const phoneValidator = validatorRegistry.get('phone')
 *
 * // 检查是否存在
 * validatorRegistry.has('email') // => true
 *
 * // 获取所有名称
 * validatorRegistry.getNames() // => ['phone', 'email', 'required', 'min10', 'max100']
 *
 * // 解析 schema（将字符串规则转换为 Standard Schema）
 * const schema = { name: 'phone', label: '手机号', componentType: 'input', rules: ['phone'] }
 * const resolved = validatorRegistry.resolveValidatorsBySchema(schema)
 * // resolved => [z.string().regex(...)]
 *
 * // 取消注册
 * validatorRegistry.unregister('max100')
 *
 * // 清空所有
 * validatorRegistry.clear()
 * ```
 *
 * @example
 * ```ts
 * // 在 createForm 中使用
 * const validatorRegistry = createValidatorsRegistry()
 * validatorRegistry.registerAll(customValidators)
 *
 * const form = createForm({
 *   schemas: [
 *     { name: 'phone', label: '手机号', componentType: 'input', rules: ['phone'] }
 *   ],
 *   validatorRegistry // 使用自定义校验规则注册中心
 * })
 * ```
 */

import type { SchemxBaseField, StandardSchemaV1, Values } from "../types"
import type { SchemxRuleKey } from "../types/rule"

/**
 * Validators 工厂函数类型。
 *
 * 接收字段 schema，返回 StandardSchemaV1 实例。
 * 用于内置规则等需要运行时上下文才能生成 validators 的场景。
 */
export type ValidatorsFactory<TValues extends Values = Values> = (
  schema?: SchemxBaseField<TValues>
) => StandardSchemaV1

/**
 * Validators 注册条目类型。
 *
 * 支持直接的 StandardSchemaV1 实例或工厂函数。
 */
export type ValidatorsEntry<TValues extends Values = Values> =
  | StandardSchemaV1
  | ValidatorsFactory<TValues>

/**
 * Validators 注册选项。
 */
export interface ValidatorsRegistryOptions {
  /** 是否覆盖已存在的同名 validators */
  override?: boolean
}

/**
 * Validators 映射类型。
 *
 * 每个 key 对应一个 StandardSchemaV1 实例或按字段 schema 延迟创建的工厂。
 */
export type ValidatorsEntryMap<TValues extends Values = Values> = Record<
  SchemxRuleKey,
  ValidatorsEntry<TValues>
>

/**
 * Validators 校验注册中心。
 *
 * 将 validators 名称映射到 StandardSchemaV1 实例或工厂函数。
 * 工厂函数接收字段 schema，用于生成带字段上下文的校验 schema。
 * 与 {@link RendererRegistryType}（渲染器注册中心）同构设计。
 *
 * @example
 * ```typescript
 * const validatorRegistry = new ValidatorsRegistryType()
 *
 * // 注册固定 validators
 * validatorRegistry.register('phone', phoneValidators)
 *
 * // 注册工厂函数（需要字段上下文）
 * validatorRegistry.register('required', (schema) => createRequiredValidators(schema))
 *
 * // 解析 schema（工厂会自动调用）
 * const [validators] = validatorRegistry.resolveValidatorsBySchema({
 *   name: 'username',
 *   label: '用户名',
 *   componentType: 'input',
 *   validators: 'required',
 * })
 * ```
 */
export class ValidatorsRegistry<TValues extends Values = Values> {
  /** Validators 存储 */
  private validators: Map<SchemxRuleKey, ValidatorsEntry<TValues>>

  /**
   * 创建 ValidatorsRegistryType 实例。
   *
   * 创建空的规则注册中心。
   */
  constructor() {
    this.validators = new Map()
  }

  /**
   * 注册校验规则。
   *
   * 支持 StandardSchemaV1 实例或工厂函数。
   * 默认覆盖已存在的同名规则，可通过 `options.override` 控制。
   *
   * @param name - validators 名称
   * @param validators - StandardSchemaV1 实例或工厂函数
   * @param options - 注册选项
   *
   * @example
   * ```typescript
   * // 注册固定 validators
   * validatorRegistry.register('phone', phoneValidators)
   *
   * // 注册工厂函数
   * validatorRegistry.register('required', (schema) => createRequiredValidators(schema))
   * ```
   */
  register(
    name: SchemxRuleKey,
    validators: ValidatorsEntry<TValues>,
    options?: ValidatorsRegistryOptions
  ): void {
    if (this.validators.has(name) && options?.override === false) {
      console.warn(`[ValidatorsRegistryType] Validators "${name}" 已存在，跳过注册`)

      return
    }

    this.validators.set(name, validators)
  }

  /**
   * 批量注册校验规则。
   *
   * 遍历映射对象逐个注册，已存在的同名规则会被直接覆盖。
   *
   * @param validators - 名称到 validators/工厂的映射对象
   *
   * @example
   * ```typescript
   * validatorRegistry.registerAll({
   *   phone: phoneValidators,
   *   required: (schema) => createRequiredValidators(schema),
   * })
   * ```
   */
  registerAll(validators: ValidatorsEntryMap<TValues>): void {
    Object.entries(validators).forEach(([name, validators]) => {
      this.validators.set(name as SchemxRuleKey, validators)
    })
  }

  /**
   * 获取指定名称的原始注册条目。
   *
   * 返回 StandardSchemaV1 实例或工厂函数，不做解析。
   * 如需按字段 schema 自动解析字符串规则和工厂，请使用 {@link resolveValidatorsBySchema}。
   *
   * @param name - validators 名称
   * @returns 对应的注册条目，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const entry = validatorRegistry.get('phone')
   * ```
   */
  get(name: SchemxRuleKey): ValidatorsEntry<TValues> | undefined {
    return this.validators.get(name)
  }

  /**
   * 解析字段 schema 上声明的校验规则。
   *
   * 字符串规则会从注册表查找；若注册项是工厂函数，则传入完整字段 schema
   * 生成 StandardSchemaV1 实例。已经是 StandardSchemaV1 的规则会原样返回。
   *
   * @param schema - 含 validators 的字段 schema。
   * @returns 解析后的 StandardSchemaV1 实例数组。
   *
   * @example
   * ```typescript
   * // 固定 validators 直接返回
   * validatorRegistry.resolveValidatorsBySchema({
   *   name: 'phone',
   *   label: '手机号',
   *   componentType: 'input',
   *   validators: 'phone',
   * })
   *
   * // 工厂函数会被调用
   * validatorRegistry.resolveValidatorsBySchema({
   *   name: 'username',
   *   label: '用户名',
   *   componentType: 'input',
   *   validators: 'required',
   * })
   * ```
   */
  resolveValidatorsBySchema(schema: SchemxBaseField<TValues>): StandardSchemaV1[] {
    const validators = schema?.rules ?? []

    const validatorsList = Array.isArray(validators) ? validators : [validators]

    const resolved: StandardSchemaV1[] = []

    for (const validators of validatorsList) {
      if (typeof validators === "string") {
        if (this.validators.has(validators)) {
          const entry = this.validators.get(validators)

          if (entry) {
            resolved.push(typeof entry === "function" ? entry(schema) : entry)
          }
        } else {
          console.warn(`[schemx] 未找到名为 "${validators}" 的校验规则`)
        }
      } else {
        if (validators) resolved.push(validators)
      }
    }

    return resolved
  }

  /**
   * 检查 validators 是否已注册。
   *
   * @param name - validators 名称
   * @returns 是否存在
   *
   * @example
   * ```typescript
   * validatorRegistry.has('phone')   // => true
   * validatorRegistry.has('custom')  // => false
   * ```
   */
  has(name: SchemxRuleKey): boolean {
    return this.validators.has(name)
  }

  /**
   * 移除校验规则。
   *
   * @param name - validators 名称
   * @returns 是否成功移除
   *
   * @example
   * ```typescript
   * validatorRegistry.unregister('phone') // => true
   * ```
   */
  unregister(name: SchemxRuleKey): boolean {
    return this.validators.delete(name)
  }

  /**
   * 获取所有已注册的 validators 名称。
   *
   * @returns validators 名称数组
   *
   * @example
   * ```typescript
   * validatorRegistry.getNames() // => ['phone', 'email', 'idCard']
   * ```
   */
  getNames(): SchemxRuleKey[] {
    return Array.from(this.validators.keys())
  }

  /**
   * 清除所有已注册的规则。
   *
   * @example
   * ```typescript
   * validatorRegistry.clear()
   * validatorRegistry.size() // => 0
   * ```
   */
  clear(): void {
    this.validators.clear()
  }

  /**
   * 获取已注册 validators 数量。
   *
   * @returns validators 数量
   *
   * @example
   * ```typescript
   * validatorRegistry.size() // => 3
   * ```
   */
  size(): number {
    return this.validators.size
  }
}

/**
 * RendererRegistryType 的实例类型
 */
export type ValidatorsRegistryType<TValues extends Values = Values> = InstanceType<
  typeof ValidatorsRegistry<TValues>
>

/**
 * 创建局部 validators 注册中心实例。
 *
 * 默认以全局 {@link globalValidatorsRegistry} 作为父级，
 * 查找时先查局部注册的规则，未命中则委托全局实例。
 *
 * @param parent - 父级注册中心，默认为全局单例
 *
 * @returns 带父级链的 ValidatorsRegistryType 实例
 *
 * @remarks
 * 用于 useForm 内部创建表单级别的注册中心实例，
 * 既能继承全局自定义规则，又能支持表单级别的规则覆盖。
 */
export function createValidatorsRegistry<
  TValues extends Values = Values,
>(): ValidatorsRegistryType<TValues> {
  return new ValidatorsRegistry<TValues>()
}
