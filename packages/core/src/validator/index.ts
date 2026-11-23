/**
 * 校验器模块
 *
 * @module core/validator
 */

export {
  createValidator,
  type Validator,
  type ValidateResult,
  type ValidateError,
  type FieldError,
} from "./validator"

export {
  createRequiredRule,
  createSelectRequiredRule,
  createUploadRequiredRule,
} from "./defaultRules"
