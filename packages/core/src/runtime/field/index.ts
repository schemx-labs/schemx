/**
 * Field 模块统一导出。
 *
 * 提供字段运行态、字段索引、动态依赖、dependency effect 和校验 effect。
 *
 * @module core/runtime/field
 */

export {
  FIELD_DYNAMIC_OVERRIDE_KEYS,
  createFieldDependenciesEffect,
  type CreateFieldDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  mountFieldResources,
  unmountFieldResources,
  updateFieldResources,
} from "./resources"

export {
  createValidationEffect,
  type CreateValidationEffectOptions,
  type ValidationEffect,
} from "./validationEffect"
