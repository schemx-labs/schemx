/**
 * form 模块统一入口。
 */

export { createFormConfig } from "./config"
export type {
  FormConfig,
  ResolvedFormConfig,
  ApplyFormConfig,
  FormConfigModel,
} from "./config"

export { createFormInstance } from "./instance"
export { createFormModel } from "./model"
export { createFormObserver } from "./observer"
export { createFormValidation, isFieldInteractive } from "./validation"

export type { FormModel } from "./model"

export { createFormApi } from "./api"
