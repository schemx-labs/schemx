/**
 * Descriptor 类型定义。
 *
 * Descriptor 是 schema 编译后的运行时输入事实源：它描述结构、稳定身份和
 * 运行期需要挂载的领域能力，但不持有 signal、scope、view state 或 effect state。
 *
 * @module core/runtime/descriptor/types
 */

import type {
  NamePath,
  SchemxBaseField,
  SchemxContainerDependencies,
  SchemxDependencyField,
  SchemxField,
  SchemxFieldDependencies,
  SchemxFormApi,
  SchemxGroupField,
  SchemxRendererKey,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  ValidationTrigger,
  Values,
} from "../../types"
import type { DefinedFieldValue, FieldRules, RequiredRule } from "../../types/rule"

/**
 * 容器静态呈现状态。
 */
export interface ContainerStaticState {
  readonly visible: boolean
  readonly readonly: boolean
  readonly disabled: boolean
}

/**
 * 容器动态属性描述。
 *
 * Group 和 Dependency 共享该描述，由运行时容器 effect 解析为动态覆盖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface ContainerDynamicPropsDescriptor<TValues extends Values = Values> {
  /**
   * 触发容器状态重算的字段。
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 原始容器 dependencies 配置。
   */
  readonly dependencies: SchemxContainerDependencies<TValues>
}

/**
 * 表单描述符，所有描述符类型的联合类型。
 *
 * 描述符树表示 schema 编译后的运行时输入事实源，在 node 实例化之前。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export type FormDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> =
  | FieldDescriptor<TValues, TName>
  | GroupDescriptor<TValues, TName>
  | DependencyDescriptor<TValues, TName>

/**
 * descriptor 支持的节点类型。
 */
export type DescriptorType = "field" | "group" | "dependency"

/**
 * descriptor 共享字段。
 */
export interface BaseDescriptor<TValues extends Values = Values> {
  /**
   * descriptor 类型。
   */
  readonly type: DescriptorType
  /**
   * 用于 keyed reconcile 的稳定 key。
   */
  readonly key: string
  /**
   * 用户扩展元信息；runtime 内核不解释具体语义。
   */
  readonly meta?: DescriptorMeta<TValues> | null
}

/**
 * 用户扩展元信息。
 */
export interface DescriptorMeta<TValues extends Values = Values> {
  readonly [key: string]: unknown
  /**
   * 原始 schema 引用；仅用于调试或高级扩展，不应被运行时修改。
   */
  readonly rawSchema?: SchemxField<TValues>
}

/**
 * 字段描述符，描述单个表单字段。
 *
 * 包含：
 * - 身份：key/name/componentType 用于协调、字段定位和渲染器匹配
 * - 静态 schema：staticSchema 是规范化后的字段 schema
 * - 动态属性：dynamicProps 描述字段属性动态覆盖的来源
 * - 校验：validation 描述字段校验资源
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径，用于保留动态依赖与校验规则的字段值类型。
 */
export interface FieldDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends BaseDescriptor<TValues> {
  readonly type: "field"
  /**
   * 字段在表单值对象中的名称路径。
   */
  readonly name: TName
  /**
   * 字段渲染器类型。
   */
  readonly componentType: SchemxRendererKey
  /**
   * 编译后、已补默认值的静态字段 schema。
   */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /**
   * 字段动态属性描述；不存在时字段只使用静态 schema。
   */
  readonly dynamicProps?: FieldDynamicPropsDescriptor<TValues, TName> | null
  /**
   * 字段校验描述；不存在时字段不挂载校验资源。
   */
  readonly validation?: FieldValidationDescriptor<TValues, TName> | null
}

/**
 * 字段动态属性描述。
 *
 * 这里保持对 `SchemxFieldDependencies` API 的引用，不在 descriptor 层
 * 另造一套 `MaybeDynamic` DSL。后续如果引入自动依赖追踪，可以在
 * DynamicProps 领域内部扩展，而不是污染 schema 编译产物。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径，用于推导动态必填与规则的字段值类型。
 */
export interface FieldDynamicPropsDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 动态属性来源。
   */
  readonly source: "dependencies"
  /**
   * 触发动态属性重算的字段。
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 原始 dependencies 配置，供 DynamicProps 运行态消费。
   */
  readonly dependencies: SchemxFieldDependencies<TValues, TName>
}

/**
 * 字段校验描述。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径，用于推导必填与规则的字段值类型。
 */
export interface FieldValidationDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 校验触发方式。
   */
  readonly trigger?: ValidationTrigger | readonly ValidationTrigger[]
  /**
   * 静态必填配置。
   */
  readonly required: RequiredRule<DefinedFieldValue<TValues, TName>> | undefined
  /**
   * 静态校验规则。
   */
  readonly rules: FieldRules<TValues, TName> | undefined
}

/**
 * 分组描述符，描述一组字段或嵌套分组。
 *
 * 分组是带呈现状态的结构容器，用于布局、组织和约束后代字段。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface GroupDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends BaseDescriptor<TValues> {
  readonly type: "group"
  /**
   * 编译后、已补默认值的分组 schema。
   */
  readonly staticSchema: SchemxResolvedGroupField<TValues>
  /**
   * 编译后的容器静态状态。
   */
  readonly staticState: ContainerStaticState
  /**
   * 容器动态属性描述。
   */
  readonly dynamicProps?: ContainerDynamicPropsDescriptor<TValues> | null
  /**
   * 分组内的子描述符树。
   */
  readonly children: readonly FormDescriptor<TValues, TName>[]
}

/**
 * 依赖描述符，描述由 dependency schema 生成的动态子树。
 *
 * 外部具有 `to` 和 `renderer` 的 Dependency Schema 会被编译为该描述符。
 * 当 trigger 字段变化时，render 函数被调用，返回新的 schema，再由 commit 边界前编译。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface DependencyDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends BaseDescriptor<TValues> {
  readonly type: "dependency"
  /**
   * 触发 dependency renderer 重新执行的字段名路径列表。
   */
  readonly triggerFields: readonly TName[]
  /**
   * 根据当前表单状态动态生成子 schema 的渲染函数。
   */
  readonly renderer: DependencyRenderer<TValues>
  /**
   * 用于判断结构 renderer 是否变化的原始函数引用。
   */
  readonly rendererIdentity: SchemxDependencyField<TValues>["renderer"]
  /**
   * 编译后的容器静态状态。
   */
  readonly staticState: ContainerStaticState
  /**
   * 容器动态属性描述。
   */
  readonly dynamicProps?: ContainerDynamicPropsDescriptor<TValues> | null
}

/**
 * dependency 描述符渲染函数，动态生成子 schema。
 *
 * @typeParam TValues - 表单值类型。
 * @param formApi - 表单 API，用于读取和操作当前表单。
 * @param abortSignal - 中止信号，用于取消过期渲染。
 * @returns 子树的 schema 数组。
 */
export type DependencyRenderer<TValues extends Values = Values> = (
  formApi: SchemxFormApi<TValues>,
  abortSignal: AbortSignal
) => Promise<SchemxField<TValues>[]> | SchemxField<TValues>[]

/**
 * 创建字段 descriptor 的选项。
 */
export interface CreateFieldDescriptorOptions<TValues extends Values = Values> {
  /**
   * 待编译的字段 schema。
   */
  readonly schema: SchemxBaseField<TValues>
  /**
   * 父级 descriptor 的 key，用于生成子节点 key 前缀。
   */
  readonly parentKey?: string
}

/**
 * 创建分组 descriptor 的选项。
 */
export interface CreateGroupDescriptorOptions<TValues extends Values = Values> {
  /**
   * 待编译的分组 schema。
   */
  readonly schema: SchemxGroupField<TValues>
  /**
   * schema 在同级列表中的位置。
   */
  readonly index: number
  /**
   * 父级 descriptor 的 key。
   */
  readonly parentKey?: string
}

/**
 * 创建 dependency descriptor 的选项。
 */
export interface CreateDependencyDescriptorOptions<TValues extends Values = Values> {
  /**
   * 待编译的依赖 schema。
   */
  readonly schema: SchemxDependencyField<TValues>
  /**
   * 父级 descriptor 的 key。
   */
  readonly parentKey?: string
}

/**
 * 创建任意 descriptor 的选项。
 */
export interface CreateDescriptorOptions<TValues extends Values = Values> {
  /**
   * 待编译的 schema（字段/分组/依赖联合类型）。
   */
  readonly schema: SchemxField<TValues>
  /**
   * schema 在同级列表中的位置。
   */
  readonly index: number
  /**
   * 父级 descriptor 的 key。
   */
  readonly parentKey?: string
}
