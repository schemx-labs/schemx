/**
 * 校验器模块
 *
 * @module core/validator
 */

export {
  createValidation,
  type CreateValidationOptions,
  type Validation,
  type ValidationFieldConfig,
} from "./validation"

export { createRequiredValidationRule } from "./rules"

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
