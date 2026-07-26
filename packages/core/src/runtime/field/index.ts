/**
 * Field 模块统一导出。
 *
 * 提供字段运行态、字段索引、动态依赖、dependency effect 和校验 effect。
 *
 * @module core/runtime/field
 */

export {
  FIELD_DEPENDENCIES_PROP_KEYS,
  createDependenciesEffect,
  type CreateDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  getDependencyEffect,
  hasDependencyEffect,
  createDependencyEffect,
  type CreateDependencyEffectOptions,
  type DependencyEffectState,
} from "./dependencyEffect"

export {
  mountDependencyNodeResources,
  updateDependencyNodeResources,
  unmountDependencyNodeResources,
} from "./dependencyNodeResources"

export {
  createFieldRegistry,
  type FieldRegistry,
  type FieldRegistryEntry,
} from "./registry"

export {
  mountFieldNodeResources,
  updateFieldNodeResources,
  unmountFieldNodeResources,
} from "./nodeResources"

export {
  createValidationEffect,
  type CreateValidationEffectOptions,
  type ValidationEffect,
} from "./validationEffect"

export {
  createFieldRuntimeState,
  setFieldStaticSchema,
  setFieldDynamicOverrides,
  resetFieldDynamicOverrides,
  type CreateFieldRuntimeStateOptions,
  type DynamicOverrideMeta,
  type FieldDynamicOverrideKey,
  type FieldDynamicOverrides,
  type FieldEffectiveSchema,
  type FieldRuntimeDiagnostics,
  type FieldRuntimeState,
} from "./runtimeState"
