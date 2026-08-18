import { createValidationRuleRegistry } from "../registry"

import { createValidationController } from "./validationController"
import { createValidator } from "./validator"

import type { FieldArrayChange } from "../fieldArray"
import type { ValidationRuleRegistry } from "../registry"
import type { NamePath, Values } from "../types"
import type {
  CreateValidatorOptions,
  ValidationAdapterOption,
  ValidationResult,
} from "./types"
import type { FieldValidationConfig } from "./validationController"

/**
 * Schema Runtime 写入校验状态所需的字段配置。
 */
export type ValidationFieldConfig<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = FieldValidationConfig<TValues, TName>

/**
 * 创建完整校验域的配置。
 */
export interface CreateValidationOptions<TValues extends Values> {
  /**
   * 复用的命名规则注册中心；未提供时创建独立实例。
   */
  readonly validationRuleRegistry?: ValidationRuleRegistry
  /**
   * 当前校验域可识别的第三方规则 adapter。
   */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]
  /**
   * 将规则异常转换为用户可见消息的处理器。
   */
  readonly onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
  /** 整表校验的字段并发数，默认 `8`。 */
  readonly validationConcurrency?: number
}

/**
 * 表单校验域的唯一入口。
 */
export interface Validation<TValues extends Values> {
  /**
   * 当前校验域使用的命名规则注册中心。
   */
  readonly registry: ValidationRuleRegistry
  /**
   * 校验单个字段并更新其错误状态。
   */
  validateField<TName extends NamePath<TValues>>(
    /**
     * 要校验的字段路径。
     */
    name: TName,
    /**
     * 本次校验使用的表单值快照。
     */
    values: TValues
  ): Promise<ValidationResult<TValues, TName>>
  /**
   * 执行所有已注册字段的校验。
   */
  validate(values: TValues): Promise<ValidationResult<TValues>>
  /**
   * 读取字段当前可展示的错误消息。
   */
  getFieldErrors(
    /**
     * 要读取的字段路径。
     */
    name: NamePath<TValues>
  ): readonly string[]
  /**
   * 读取多个字段当前可展示的错误消息。
   */
  getFieldsErrors(names?: readonly NamePath<TValues>[]): readonly {
    readonly name: NamePath<TValues>
    readonly errors: readonly string[]
  }[]
  /**
   * 写入字段的外部错误消息。
   */
  setFieldErrors(
    /**
     * 要写入的字段路径。
     */
    name: NamePath<TValues>,
    /**
     * 外部错误消息；空数组清除外部错误。
     */
    messages: readonly string[]
  ): void
  /**
   * 批量写入多个字段的外部错误消息。
   */
  setFieldsErrors(
    fields: readonly {
      readonly name: NamePath<TValues>
      readonly messages: readonly string[]
    }[]
  ): void
  /**
   * 清除字段全部错误来源。
   */
  clearFieldErrors(name: NamePath<TValues>): void
  /**
   * 批量清除多个字段的全部错误来源。
   */
  clearFieldsErrors(names: readonly NamePath<TValues>[]): void
  /**
   * 清除所有字段错误。
   */
  clearErrors(): void
  /**
   * 同步 Schema 字段配置并编译其规则。
   */
  syncSchemaField<TName extends NamePath<TValues>>(
    config: ValidationFieldConfig<TValues, TName>
  ): boolean
  /**
   * 移除 Schema 字段配置，但保留运行时覆盖。
   */
  removeSchemaField(
    /**
     * 要移除 Schema 配置的字段路径。
     */
    name: NamePath<TValues>
  ): void
  /**
   * 设置字段的运行时规则覆盖。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    /**
     * 包含运行时规则覆盖的字段配置。
     */
    config: ValidationFieldConfig<TValues, TName>
  ): boolean
  /**
   * 移除字段运行时规则覆盖。
   */
  removeFieldRules(
    /**
     * 要移除运行时规则覆盖的字段路径。
     */
    name: NamePath<TValues>
  ): void
  /**
   * 移除字段全部规则和错误状态。
   */
  removeField(
    /**
     * 要移除的字段路径。
     */
    name: NamePath<TValues>
  ): void
  /**
   * 获取命名规则。
   */
  getRule: ValidationRuleRegistry["get"]
  /**
   * 注册命名规则。
   */
  registerRule: ValidationRuleRegistry["register"]
  /**
   * 判断命名规则是否已注册。
   */
  hasRule(
    /**
     * 要查询的命名规则名称。
     */
    name: string
  ): boolean
  /**
   * 释放校验域订阅和运行状态。
   */
  destroy(): void
}

type ValidationFieldArrayInvalidator<TValues extends Values> = (
  path: NamePath<TValues>,
  change: FieldArrayChange
) => void

const validationFieldArrayInvalidators = new WeakMap<object, unknown>()

/** 获取 FormModel 使用的 FieldArray 校验失效端口；不进入公开 Validation 契约。 */
export function getValidationFieldArrayInvalidator<TValues extends Values>(
  validation: Validation<TValues>
): ValidationFieldArrayInvalidator<TValues> {
  const invalidator = validationFieldArrayInvalidators.get(validation as object)

  if (!invalidator) {
    throw new Error("[schemx] Validation FieldArray port is not available.")
  }

  return invalidator as ValidationFieldArrayInvalidator<TValues>
}

/**
 * 创建并统一管理表单的规则编译、执行、错误状态和 Registry 订阅。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 校验域使用的 Registry、adapter 与异常消息配置。
 * @returns 可同步字段配置、注册规则并执行校验的校验域。
 *
 * @example
 * ```ts
 * const validation = createValidation<LoginForm>()
 * const result = await validation.validate({ email: "a@example.com" })
 * ```
 */
export function createValidation<TValues extends Values = Values>(
  options: CreateValidationOptions<TValues> = {}
): Validation<TValues> {
  /*
   * 每个校验域默认拥有独立的命名规则注册中心。
   */
  const registry = options.validationRuleRegistry ?? createValidationRuleRegistry()

  /*
   * Validator 负责执行规则和维护错误来源，Controller 负责编译字段配置。
   */
  const validator = createValidator<TValues>({
    onRuleError: options.onRuleError,
    validationConcurrency: options.validationConcurrency,
  })

  const controller = createValidationController({
    validator,
    registry,
    validatorAdapters: options.validatorAdapters,
  })

  const validateField = validator.validateField.bind(validator)

  const validate = validator.validate.bind(validator)

  const getFieldErrors = validator.getFieldErrors.bind(validator)

  const getFieldsErrors = validator.getFieldsErrors.bind(validator)

  const setFieldErrors = validator.setFieldErrors.bind(validator)

  const setFieldsErrors = validator.setFieldsErrors.bind(validator)

  const clearFieldErrors = validator.clearFieldErrors.bind(validator)

  const clearFieldsErrors = validator.clearFieldsErrors.bind(validator)

  const clearErrors = validator.clearErrors.bind(validator)

  const syncSchemaField = controller.syncField.bind(controller)

  const removeSchemaField = controller.removeSchemaField.bind(controller)

  const setFieldRules = controller.setFieldRules.bind(controller)

  const removeFieldRules = controller.removeFieldRules.bind(controller)

  const removeField = controller.removeField.bind(controller)

  const invalidateFieldArray = controller.invalidateFieldArray.bind(controller)

  const getRule = registry.get.bind(registry)

  const registerRule = registry.register.bind(registry)

  const hasRule = registry.has.bind(registry)

  const destroy = (): void => {
    controller.destroy()
    validator.destroy()
  }

  const validation = {
    registry,
    validateField,
    validate,
    getFieldErrors,
    getFieldsErrors,
    setFieldErrors,
    setFieldsErrors,
    clearFieldErrors,
    clearFieldsErrors,
    clearErrors,
    syncSchemaField,
    removeSchemaField,
    setFieldRules,
    removeFieldRules,
    removeField,
    getRule,
    registerRule,
    hasRule,
    destroy,
  }

  validationFieldArrayInvalidators.set(validation, invalidateFieldArray)

  return validation
}
