/**
 * Core 内部校验模块。
 *
 * `createValidator` 仅供 `FormModel` 装配校验域，不属于 `@schemx/core` 根入口的公开 API。
 *
 * @module core/validator
 */

// Core 内部创建 Validator 的装配入口。
export { createValidator, type CreateValidatorOptions } from "./validator"

export { createRequiredValidationRule } from "./built-in.rules"

export type { ValidationAdapterV1 } from "../types/validationAdapter"

export type {
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
  ValidationRule,
  AdapterRule,
  ValidationAdapterRule,
  ValidationAdapterID,
  ValidationAdapter,
  ValidationAdapterRegistration,
  ValidationAdapterOption,
  FieldValidationConfig,
  FieldValidationError,
  FormValidationError,
  ValidationError,
  ValidationSuccess,
  ValidationFailure,
  ValidationCancelled,
  ValidationResult,
  Validator,
} from "./types"

export {
  createValidationSuccess,
  createValidationFailure,
  createValidationCancelled,
} from "./result"
