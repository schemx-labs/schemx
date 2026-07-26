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
  SchemxFieldSchemaPatch,
  SchemxInstance,
  SchemxFormApi,
  SchemxDefaultProps,
  ResolvedSchemxDefaultProps,
} from "./form"

export type {
  RequiredOptions,
  RequiredRule,
  DefinedFieldValue,
  ValidationRuleDefinition,
  ValidationRuleName,
  FieldRule,
  FieldRules,
} from "./rule"

export type { SchemxRendererKey, SchemxRendererDefinition } from "./renderer"

export type {
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBase,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  SchemxResolvedGroupField,
  SchemxGroupField,
  SchemxDependencyField,
  SchemxBaseField,
  SchemxField,
  SchemxFormItemProps,
  SchemxDependencyRendererContext,
} from "./schema"

export type { SchemxProps, SchemxGlobalContext } from "./form"

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
  SchemxDependencies,
  SchemxDependenciesConditionKey,
  SchemxDependenciesStaticProps,
} from "./dependencies"

export type { StandardSchemaV1 } from "./standardSchema"

export type { ValidationAdapterV1 } from "./validationAdapter"
