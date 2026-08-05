/**
 * core 模块统一导出
 *
 * 聚合 Validator、ValidationRuleRegistry、RendererRegistry 等核心公开 API。
 *
 * @module core
 */

export { createValidator, type Validator, type CreateValidatorOptions } from "./validator"

export {
  createRendererRegistry,
  RendererRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./registry"

export {
  createForm,
  type CreateFormOptions,
  type FormCallbackOptions,
  type FormLifecycleOptions,
  type FormRegistryOptions,
  type FormSchemaOptions,
  type ResolvedCreateFormOptions,
} from "./createForm"

export {
  configureSchemx,
  getGlobalSchemxConfig,
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
  schemaConfigKeys,
  excludeSchemaConfigKeys,
  type SchemxConfig,
  type SchemxConfigKey,
  type ExcludeSchemxConfigKeys,
} from "./config"

export { type SchemxContext } from "./runtime/context"

export {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
  type SchemxSchemasListener,
} from "./createSchemas"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./runtime/view"

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
  createValidationRuleRegistry,
  ValidationRuleRegistry,
  type ValidationRuleFactoryContext,
  type ValidationRuleFactory,
  type ValidationRuleEntry,
  type ValidationRuleMap,
  type ValidationRuleRegistryChange,
  type ValidationRuleRegistryListener,
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
  RequiredOptions,
  RequiredRule,
  DefinedFieldValue,
  ValidationRuleDefinition,
  ValidationRuleName,
  FieldRule,
  FieldRules,
  Values,
  Dynamic,
  NamePath,
  FieldValue,
  DeepReadonly,
  CSSProperties,
  ValidationTrigger,
  StandardSchemaV1,
  SchemxInstance,
  SchemxSchemaConfig,
  SchemxGlobalContext,
  SchemxRendererKey,
  SchemxRendererDefinition,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxBase,
  SchemxGroupField,
  SchemxBaseField,
  SchemxExactBaseField,
  SchemxResolvedField,
  SchemxDependencyField,
  SchemxField,
  SchemxFormItemProps,
  SchemxFieldDependencies,
  SchemxGroupDependencies,
  SchemxDependencyDependencies,
  SchemxDependencies,
  SchemxContainerDependencies,
  SchemxConditionFn,
  SchemxDependenciesStaticProps,
} from "./types"

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
} from "./validator/types"
