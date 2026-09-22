/**
 * core 模块统一导出
 *
 * 聚合表单运行时、Registry 和校验相关的核心公开 API。
 * Validator 实现仅供 Core 内部 FormModel 使用，不从根入口导出。
 *
 * @module core
 */

import type { Values } from "./types/form"

/**
 * Schemx Config 的适配层扩展接口。
 *
 * 适配层可通过声明合并增加框架专属的配置字段。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxConfigDefinition<TValues extends Values = Values> {}

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
  mergeConfig,
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

export {
  createValidationSuccess,
  createValidationFailure,
  createValidationCancelled,
} from "./validator/result"
