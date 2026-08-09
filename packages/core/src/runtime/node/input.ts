/**
 * 编译器传递给 RuntimeNode 生命周期的短生命周期输入契约。
 *
 * @module core/runtime/node/input
 */

import type {
  NamePath,
  SchemxContainerDependencies,
  SchemxDependencyField,
  SchemxField,
  SchemxFieldDependencies,
  SchemxFormApi,
  SchemxRendererKey,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  ValidationTrigger,
  Values,
} from "../../types"
import type { DefinedFieldValue, FieldRules, RequiredRule } from "../../types/rule"

/** 容器节点的已解析静态状态。 */
export interface PresentationStaticState {
  /** 最终解析后的可见状态。 */
  readonly visible: boolean
  /** 最终解析后的只读状态。 */
  readonly readonly: boolean
  /** 最终解析后的禁用状态。 */
  readonly disabled: boolean
}

/** 容器节点的动态属性配置。 */
export interface PresentationDynamicProps<TValues extends Values = Values> {
  /** 触发动态属性重新计算的字段路径。 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 容器节点的动态依赖配置。 */
  readonly dependencies: SchemxContainerDependencies<TValues>
}

/** 字段节点的动态属性配置。 */
export interface FieldDynamicProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 动态属性的来源标记。 */
  readonly source: "dependencies"
  /** 触发字段依赖重新计算的路径。 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 字段节点的动态依赖配置。 */
  readonly dependencies: SchemxFieldDependencies<TValues, TName>
}

/** 字段节点的校验配置。 */
export interface FieldValidation<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 字段规则使用的校验触发时机。 */
  readonly trigger?: ValidationTrigger | readonly ValidationTrigger[]
  /** 字段的必填配置。 */
  readonly required: RequiredRule<DefinedFieldValue<TValues, TName>> | undefined
  /** 字段的规则列表。 */
  readonly rules: FieldRules<TValues, TName> | undefined
}

/** Dependency 节点渲染子 schema 的函数。 */
export type DependencyRenderer<TValues extends Values = Values> = (
  formApi: SchemxFormApi<TValues>,
  abortSignal: AbortSignal
) => Promise<SchemxField<TValues>[]> | SchemxField<TValues>[]

/** Compiler 传给 reconciler 的短生命周期节点输入。 */
export type RuntimeNodeInput<TValues extends Values = Values> =
  | FieldRuntimeNodeInput<TValues>
  | GroupRuntimeNodeInput<TValues>
  | DependencyRuntimeNodeInput<TValues>

/** Field 节点输入。 */
export interface FieldRuntimeNodeInput<TValues extends Values = Values> {
  /** 节点类型标记。 */
  readonly type: "field"
  /** 节点的稳定 key。 */
  readonly key: string
  /** 用于判断配置是否发生替换的身份令牌。 */
  readonly configToken: symbol
  /** 字段路径。 */
  readonly name: NamePath<TValues>
  /** 渲染器类型。 */
  readonly componentType: SchemxRendererKey
  /** 编译后的静态字段配置。 */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /** 字段动态属性配置；未配置时为 null。 */
  readonly dynamicProps: FieldDynamicProps<TValues> | null
  /** 字段校验配置；无需校验时为 null。 */
  readonly validation: FieldValidation<TValues> | null
}

/** Group 节点输入。 */
export interface GroupRuntimeNodeInput<TValues extends Values = Values> {
  /** 节点类型标记。 */
  readonly type: "group"
  /** 节点的稳定 key。 */
  readonly key: string
  /** 用于判断配置是否发生替换的身份令牌。 */
  readonly configToken: symbol
  /** 编译后的静态分组配置。 */
  readonly staticSchema: SchemxResolvedGroupField<TValues>
  /** 分组的静态呈现状态。 */
  readonly staticState: PresentationStaticState
  /** 分组动态属性配置；未配置时为 null。 */
  readonly dynamicProps: PresentationDynamicProps<TValues> | null
}

/** Dependency 节点输入。 */
export interface DependencyRuntimeNodeInput<TValues extends Values = Values> {
  /** 节点类型标记。 */
  readonly type: "dependency"
  /** 节点的稳定 key。 */
  readonly key: string
  /** 用于判断配置是否发生替换的身份令牌。 */
  readonly configToken: symbol
  /** 触发动态 renderer 重新执行的字段路径。 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 根据当前表单值生成子 Schema 的 renderer。 */
  readonly renderer: DependencyRenderer<TValues>
  /** 原始 renderer 引用，用于判断 renderer 是否发生变化。 */
  readonly rendererIdentity: SchemxDependencyField<TValues>["renderer"]
  /** 依赖节点的静态呈现状态。 */
  readonly staticState: PresentationStaticState
  /** 依赖节点动态属性配置；未配置时为 null。 */
  readonly dynamicProps: PresentationDynamicProps<TValues> | null
}
