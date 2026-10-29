/**
 * core 模块统一导出
 *
 * 聚合表单运行时、Registry 和校验相关的核心公开 API。
 * Validator 实现仅供 Core 内部运行模块与 facade 使用，不从根入口导出。
 *
 * @module core
 */

export { createPresetRuleRegistry, createRendererRegistry } from "./registry"

export type {
  PresetRuleRegistry,
  RendererRegistry,
  PresetRuleFactoryContext,
  PresetRuleFactory,
  PresetRuleEntry,
  PresetRuleMap,
  PresetRuleRegistryChange,
  PresetRuleRegistryListener,
  RegistryOptions,
  RendererDescriptor,
  RendererEntry,
  RendererMap,
  RendererPropsTransformer,
  RendererRegistration,
  RendererTransformContext,
} from "./registry"

export {
  createForm,
  createFormWithConfig,
  type CreateFormOptions,
  type FormCallbackOptions,
  type FormLifecycleOptions,
  type FormPerformanceOptions,
  type FormRegistryOptions,
  type FormSchemaOptions,
  type ResolvedCreateFormOptions,
} from "./createForm"

export {
  createFormStateAdapter,
  type FieldRefSnapshotSource,
  type FieldSnapshotSource,
  type FieldStateSnapshot,
  type FormStateAdapter,
  type SnapshotSource,
} from "./adapter/formStateAdapter"

export { getFormCreationConfig, type FormCreationSnapshot } from "./adapter"

export type {
  SchedulerDiagnostics,
  SchedulerIdleOptions,
  SchedulerOptions,
  SchedulerTaskPriority,
  SchedulerTrackOptions,
} from "./scheduler"

export {
  configureSchemx,
  getGlobalSchemxConfig,
  normalizeSchemxConfig,
  mergeConfig,
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
  type MergeConfigOptions,
  type SchemxConfigSnapshot,
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
  type SchemxConfig,
  type SchemxConfigDefinition,
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

export type { NodeId } from "./node"

export type {
  SchemxViewDebugMeta,
  SchemxViewDynamicItem,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./view"

export { isSchemxViewFieldSchema, isViewDynamicSchema, isViewGroupSchema } from "./view"

export type { FormConfig, ResolvedFormConfig } from "./config"

export type {
  FieldRef,
  FieldRefState,
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
  SchemxInstanceDefinition,
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
export type { FieldState, StoreState } from "./store"
export type { ReadonlyState } from "./reactivity"

export {
  createField,
  type SchemxFieldInstance,
  type SchemxFieldState,
} from "./createField"

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
  createFieldKey,
} from "./utils"

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
} from "./validator"

export {
  createValidationSuccess,
  createValidationFailure,
  createValidationCancelled,
} from "./validator"

export {
  createSchemx,
  type SchemxApi,
  type SchemxConfigureOptions,
  type CreateSchemxOptions,
} from "./createSchemx"
