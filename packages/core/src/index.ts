/**
 * core 模块统一导出
 *
 * 聚合 Validator、RendererRegistryType、ValidatorsRegistryType 等核心模块的公开 API。
 *
 * @module core
 */

export {
  createValidator,
  type Validator,
  type ValidateResult,
  type ValidateError,
  type FieldError,
} from "./validator"

export {
  createRendererRegistry,
  type RendererRegistryType,
  type RegistryOptions,
  type RendererMap,
} from "./registry"

export { createForm, type CreateFormOptions } from "./createForm"
export { createForm as createFormInstance } from "./createForm"
export {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
  type SchemxSchemasListener,
} from "./createSchemas"

export {
  createLifecycle,
  createLifecycleBus,
  type LifecycleBus,
  type LifecycleHooks,
  type LifecycleListener,
} from "./lifecycle"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./view"

export { createField, type SchemxFieldInstance } from "./createField"

export {
  createEffect,
  type CleanupFn,
  type EffectCallback,
  type CreateEffectReturn,
} from "./createEffect"

export {
  createWatch,
  createWatchField,
  createWatchFields,
  createWatchAll,
  type WatchFieldCallback,
  type WatchFieldsCallback,
  type WatchAllCallback,
  type CreateWatchOptions,
  type CreateWatchReturn,
} from "./createWatch"

export {
  createValidatorsRegistry,
  type ValidatorsRegistryType,
  type ValidatorsRegistryOptions,
  type ValidatorsFactory,
  type ValidatorsEntry,
  type ValidatorsEntryMap,
} from "./registry"

export {
  isBaseSchema,
  isGroupSchema,
  isDependencySchema,
  isBaseResolvedSchema,
  isGroupResolvedSchema,
  getByPath,
  setByPath,
  collectObjectPathsByLeaf,
} from "./utils"

export type {
  Values,
  Dynamic,
  NamePath,
  FieldValue,
  DeepReadonly,
  CSSProperties,
  ValidationTrigger,
  StandardSchemaV1,
  SchemxInstance,
  SchemxProps,
  SchemxGlobalContext,
  SchemxRuleDefinition,
  SchemxRuleDefinitionKey,
  SchemxRuleBuiltinKey,
  SchemxRules,
  SchemxRendererKey,
  SchemxRendererDefinition,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxBase,
  SchemxGroupField,
  SchemxBaseField,
  SchemxResolvedField,
  SchemxDependencyField,
  SchemxField,
  SchemxFormItemProps,
  SchemxDependencies,
  SchemxConditionFn,
  SchemxDependenciesStaticProps,
  SchemxDictionary,
  SchemxWithDictionary,
} from "./types"
