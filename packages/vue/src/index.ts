/**
 * schemx 统一导出入口
 *
 * @module @schemx/vue
 */
import "./styles/index.css"

// 载入 Core Schema 与配置的 Vue 声明合并，使适配包消费根入口时获得完整类型。
import "./types/definition"

/**
 * 默认导出
 */
export { default } from "./form"
export { default as schemxForm } from "./form"
export type { SchemxFormPlugin, SchemxInstallOptions } from "./form"

/**
 * 全局渲染器注册实例
 */
export { rendererRegistry } from "./utils/rendererProvider"

export { normalizeSchemxGutter, type SchemxNormalizedGutter } from "./utils/layout"

/**
 * 全局预设规则注册实例
 */
export { presetRuleRegistry } from "./utils/presetRuleProvider"

/**
 * Hooks
 */
export * from "./hooks"

/**
 * Context
 */
export * from "./context"

/**
 * 高阶组件
 */
export { WithRemoteOptions } from "./hocs"

/**
 * 组件
 */
export { default as Field, type SchemxFieldProps } from "./components/Field"
export { default as Group, type SchemxGroupProps } from "./components/Group"
export { default as Col } from "./components/Col"
export { default as Row } from "./components/Row"
export { default as Icon } from "./components/Icon"
export { default as Wrapper } from "./components/Wrapper/index.vue"
export {
  default as ConfigProvider,
  type ConfigProviderProps,
} from "./components/ConfigProvider"

/**
 * schemx/core 导出
 * 工厂专属类型仅从 Core 导入。
 */
/* eslint-disable import/export -- Vue 的 SchemxLayout 兼容别名需要覆盖同名 Core 类型。 */
export {
  createPresetRuleRegistry,
  createRendererRegistry,
  createForm,
  configureSchemx,
  getGlobalSchemxConfig,
  normalizeSchemxConfig,
  mergeConfig,
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
  createSchemas,
  isSchemxSchemas,
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
  createField,
  createWatch,
  createWatchField,
  createWatchFields,
  createWatchAll,
  createSignalEffect,
  runSignalUntracked,
  createSignalWatch,
  createDebouncedSignalWatch,
  isFieldSchema,
  isGroupSchema,
  isDependencySchema,
  isDynamicSchema,
  getByPath,
  setByPath,
  collectObjectPathsByLeaf,
  createFieldKey,
  createValidationSuccess,
  createValidationFailure,
  createValidationCancelled,
} from "@schemx/core"

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
  CreateFormOptions,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
  ResolvedCreateFormOptions,
  SchedulerDiagnostics,
  SchedulerIdleOptions,
  SchedulerOptions,
  SchedulerTaskPriority,
  SchedulerTrackOptions,
  MergedSchemxConfig,
  MergeConfigOptions,
  SchemxConfig,
  SchemxConfigDefinition,
  SchemxConfigKey,
  ExcludeSchemxConfigKeys,
  SchemxSchemas,
  SchemxSchemasInput,
  SchemxSchemasListener,
  SchemxViewDebugMeta,
  SchemxViewDynamicItem,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  SchemxFieldInstance,
  WatchFieldCallback,
  WatchFieldsCallback,
  WatchAllCallback,
  CreateWatchOptions,
  CreateWatchReturn,
  SignalEffectOptions,
  SignalEffectDispose,
  SignalWatchOptions,
  DebouncedSignalWatchOptions,
  DebouncedSignalWatchControls,
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
} from "@schemx/core"

// 显式导出包含 Vue 默认配置的工厂，覆盖 Core 同名导出。
export { createSchemx } from "./createSchemx"

// 显式导出 Vue 的 SchemxLayout 兼容别名，覆盖 Core 旧类型名。
export type { SchemxLayout } from "./types/layout"

/**
 * Types
 */
export * from "./types"
/* eslint-enable import/export */

export { defaultConfig } from "./config/defaultConfig"
