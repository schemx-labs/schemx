/**
 * core 模块统一导出
 *
 * 聚合表单运行时、Registry 和校验相关的核心公开 API。
 * Validator 实现仅供 Core 内部 FormModel 使用，不从根入口导出。
 *
 * @module core
 */

export {
  createPresetRuleRegistry,
  createRendererRegistry,
  PresetRuleRegistry,
  RendererRegistry,
  type PresetRuleFactoryContext,
  type PresetRuleFactory,
  type PresetRuleEntry,
  type PresetRuleMap,
  type PresetRuleRegistryChange,
  type PresetRuleRegistryListener,
  type RegistryOptions,
  type RendererMap,
} from "./registry"

export {
  createForm,
  type CreateFormOptions,
  type FormCallbackOptions,
  type FormLifecycleOptions,
  type FormPerformanceOptions,
  type FormRegistryOptions,
  type FormSchemaOptions,
  type ResolvedCreateFormOptions,
} from "./createForm"

export type {
  SchedulerDiagnostics,
  SchedulerIdleOptions,
  SchedulerOptions,
  SchedulerTaskPriority,
  SchedulerTrackOptions,
} from "./runtime/scheduler"

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
  type SchemxConfig,
  type SchemxConfigKey,
  type ExcludeSchemxConfigKeys,
} from "./config"

export {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
  type SchemxSchemasListener,
} from "./createSchemas"

export type {
  SchemxViewDebugMeta,
  SchemxViewDynamicItem,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./runtime/view"

export {
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
} from "./runtime/view"

export { createField, type SchemxFieldInstance } from "./createField"

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
  createSignalEffect,
  runSignalUntracked,
  createSignalWatch,
  createDebouncedSignalWatch,
  type SignalEffectOptions,
  type SignalEffectDispose,
  type SignalWatchOptions,
  type DebouncedSignalWatchOptions,
  type DebouncedSignalWatchControls,
} from "./reactivity"

export {
  isFieldSchema,
  isGroupSchema,
  isDependencySchema,
  isDynamicSchema,
  getByPath,
  setByPath,
  collectObjectPathsByLeaf,
} from "./utils"

export type {
  RequiredOptions,
  RequiredConfig,
  DefinedFieldValue,
  PresetRuleDefinition,
  PresetRuleName,
  FieldRule,
  FieldRules,
  Values,
  Dynamic,
  NamePath,
  FieldValue,
  SetValueAction,
  SetValuesAction,
  DeepReadonly,
  CSSProperties,
  ValidationTrigger,
  StandardSchemaV1,
  AsyncValidatorRule,
  AsyncValidatorDescriptor,
  SchemxInstance,
  SchemxFormApi,
  SchemxFieldRulesMap,
  SchemxSchemaConfig,
  SchemxSchemaConfigDefinition,
  SchemxRendererKey,
  SchemxRendererDefinition,
  SchemxLayout,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBaseComponentProps,
  SchemxCoreBaseComponentProps,
  SchemxComponentPropsDefinition,
  SchemxComponentProps,
  SchemxRendererPropsMap,
  SchemxBase,
  SchemxGroupField,
  SchemxBaseField,
  SchemxExactBaseField,
  SchemxDependencyField,
  SchemxDynamicDefinition,
  SchemxDynamicField,
  SchemxDynamicArrayPath,
  SchemxDynamicNamePath,
  SchemxDynamicItemGroup,
  SchemxDynamicItemSchema,
  SchemxDynamicItemDependency,
  SchemxDynamicItemDependencyRendererContext,
  SchemxField,
  SchemxFormItemProps,
  SchemxFieldDependencies,
  SchemxFieldDependenciesDefinition,
  SchemxGroupDependencies,
  SchemxDependencyDependencies,
  SchemxDynamicDependencies,
  SchemxContainerDependencies,
  SchemxConditionFn,
  FieldArrayItemValue,
  FieldArrayChange,
  FieldArrayPath,
  ValidationAdapterV1,
} from "./types"

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
  FieldValidationError,
  FormValidationError,
  ValidationError,
  ValidationSuccess,
  ValidationFailure,
  ValidationCancelled,
  ValidationResult,
} from "./validator/types"
