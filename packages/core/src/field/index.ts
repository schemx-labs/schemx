/**
 * Field 模块统一导出。
 *
 * 提供字段模型、字段索引、动态依赖和 dependency slot。
 *
 * @module core/field
 */

export {
  FIELD_DEPENDENCIES_PROP_KEYS,
  createDependenciesEffect,
  type CreateDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  getDependencySlot,
  hasDependencySlot,
  createDependencyEffect,
  type CreateDependencyEffectOptions,
  type DependencyEffectSlot,
} from "./dependencyEffect"

export {
  createFieldModel,
  updateFieldModel,
  type FieldModel,
  type FieldModelSnapshot,
} from "./model"

export {
  createFieldRegistry,
  type FieldRegistry,
  type FieldRegistryEntry,
} from "./registry"

export {
  createValidationEffect,
  type CreateValidationEffectOptions,
  type ValidationModel,
} from "./validationEffect"
