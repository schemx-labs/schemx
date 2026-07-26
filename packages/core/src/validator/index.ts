/**
 * 校验器模块
 *
 * @module core/validator
 */

export { createValidator, type Validator, type CreateValidatorOptions } from "./validator"

export { createRequiredValidationRule, createStandardSchemaValidationRule } from "./rules"

export {
  createValidationController,
  type CreateValidationControllerOptions,
  type FieldValidationConfig,
  type ValidationController,
} from "./validationController"

export type {
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
  ValidationRule,
  AdapterRule,
  ValidationAdapterRule,
  ValidationAdapterID,
  ValidationAdapterV1,
  ValidationAdapter,
  ValidationAdapterRegistration,
  ValidationAdapterOption,
  FieldValidationError,
  FormValidationError,
  ValidationError,
  ValidationSuccess,
  ValidationFailure,
  ValidationCancelled,
  ValidationResult,
} from "./types"
