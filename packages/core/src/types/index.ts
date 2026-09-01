/**
 * 类型定义统一导出
 *
 * @module types
 */

export type {
  FieldValue,
  Values,
  Dynamic,
  NamePath,
  ValidationTrigger,
  SchemxFieldRulesMap,
  SchemxSchemaConfig,
  SchemxGlobalContext,
} from "./form"

export type { SchemxInstance, SchemxFormApi } from "./instance"

export type {
  RequiredOptions,
  RequiredConfig,
  DefinedFieldValue,
  PresetRuleDefinition,
  PresetRuleName,
  FieldRule,
  FieldRules,
} from "./rule"

export type { SchemxRendererKey, SchemxRendererDefinition } from "./renderer"

export type {
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxRuntimeInjectedProp,
  SchemxRendererPropsMap,
  SchemxFieldDefinition,
  SchemxBase,
  SchemxResolvedBaseField,
  SchemxBaseField,
  SchemxExactBaseField,
  SchemxFormItemProps,
} from "./field"

export type { SchemxField, SchemxResolvedField } from "./schema"

export type {
  SchemxGroupFieldDefinition,
  SchemxResolvedGroupField,
  SchemxGroupField,
} from "./group"

export type { SchemxDependencyRendererContext, SchemxDependencyField } from "./dependency"

export type {
  DisposeBag,
  DisposeCallback,
  DisposePhase,
  DisposeSubscription,
} from "./dispose"

export type { DeepNamePath, PathValueByArray, PathValueByString } from "./namePathType"

export type { DeepReadonly, Exact, CSSProperties } from "./utils"

export type {
  SchemxConditionFn,
  SchemxContainerDependencies,
  SchemxDependencyDependencies,
  SchemxFieldDependencies,
  SchemxFieldDependenciesConditionKey,
  SchemxFieldDependenciesStaticProps,
  SchemxGroupDependencies,
  SchemxDependencies,
  SchemxDependenciesConditionKey,
  SchemxDependenciesStaticProps,
} from "./dependencies"

export type { StandardSchemaV1 } from "./standardSchema"

export type { ValidationAdapterV1 } from "./validationAdapter"
