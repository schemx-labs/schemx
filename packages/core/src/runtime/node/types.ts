/**
 * Node 子系统类型定义。
 *
 * 定义所有 Node 类型（root / field / group / dependency）、
 * 生命周期接口（Scope）、
 * 以及创建选项（Create*Options）。
 *
 * @module core/runtime/node/types
 */

import type { ComputedSignal, Signal } from "../../reactivity"
import type {
  NamePath,
  SchemxBaseField,
  SchemxComponentProps,
  SchemxDependencyField,
  SchemxGroupField,
  SchemxResolvedBaseField,
  Values,
} from "../../types"
import type { FieldRules } from "../../types/rule"
import type { DependencyRendererEffect } from "../dependency/rendererEffect"
import type { SchemxViewSchema } from "../view/types"

/**
 * Scope 执行的清理函数。
 */
export type Cleanup = () => void

/**
 * cleanup 注册后的释放句柄。
 *
 * 可通过 handle.dispose() 提前释放该 cleanup，不影响 scope 整体生命周期。
 */
export interface CleanupHandle {
  /**
   * 标记该清理任务是否已经执行或被释放。
   */
  readonly disposed: boolean
  /**
   * 提前执行该 cleanup 并从 scope 注销；幂等。
   */
  dispose(): void
}

/**
 * Runtime 资源生命周期边界。
 *
 * 提供资源注册（add）、子 scope 创建（child）、以及整体释放（dispose）能力。
 * dispose 幂等；先释放子 scope，再按 LIFO 执行当前 scope 的 cleanup。
 */
export interface Scope {
  /**
   * 标记当前 scope 是否已经进入释放状态。
   */
  readonly disposed: boolean
  /**
   * 注册一个 cleanup 函数，返回可提前释放的句柄。
   *
   * @param cleanup - 资源释放函数。
   * @returns 可提前执行该释放函数的句柄。
   */
  add(cleanup: Cleanup): CleanupHandle
  /**
   * 创建子 scope；父 scope 释放时自动释放子 scope。
   */
  child(): Scope
  /**
   * 释放当前 scope 及所有子 scope，按 LIFO 执行 cleanup；幂等。
   */
  dispose(): void
}

/**
 * Scope 内部保存的清理记录。
 */
export interface CleanupRecord {
  /**
   * 当前记录对应的清理函数。
   */
  cleanup: Cleanup
  /**
   * 标记该清理函数是否已经执行。
   */
  disposed: boolean
}

/**
 * Runtime node 支持的节点类型。
 */
export type NodeType = "root" | "field" | "group" | "dependency"

/**
 * Node 内部稳定 id。
 */
export type NodeId = number

/**
 * Group、Dependency 和 Field 共享的有效呈现状态。
 */
export interface PresentationStaticState {
  /**
   * 当前节点及其后代是否可见。
   */
  readonly visible: boolean
  /**
   * 当前节点及其后代是否只读。
   */
  readonly readonly: boolean
  /**
   * 当前节点及其后代是否禁用。
   */
  readonly disabled: boolean
}

/**
 * 容器 dependencies 解析出的动态呈现覆盖。
 */
export type PresentationDynamicOverrides = Partial<PresentationStaticState>

/**
 * 字段 dependencies 可以覆盖的字段属性。
 */
export type FieldDynamicOverrideKey =
  | "componentProps"
  | "placeholder"
  | "readonlyPlaceholder"
  | "required"
  | "showRequiredMark"
  | "readonly"
  | "disabled"
  | "visible"
  | "rules"

/**
 * 字段 dependencies 解析出的动态覆盖集合。
 *
 * @typeParam TValues - 表单值类型。
 */
export type FieldDynamicOverrides<TValues extends Values = Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, FieldDynamicOverrideKey>
>

/**
 * 字段动态配置更新的诊断信息。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldRuntimeDiagnostics<TValues extends Values = Values> {
  /**
   * 触发最近一次诊断更新的来源。
   */
  readonly lastUpdatedBy: "static-schema" | "dependencies" | "reset" | "dispose"
  /**
   * 每次诊断更新递增的版本号。
   */
  readonly version: number
  /**
   * 最近一次动态更新依赖的字段路径。
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 最近一次被动态覆盖的字段属性。
   */
  readonly overriddenKeys: readonly FieldDynamicOverrideKey[]
  /**
   * 最近一次动态解析或执行产生的错误。
   */
  readonly error: Error | null
}

/**
 * 字段合并静态配置和动态覆盖后的最终配置。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldEffectiveSchema<TValues extends Values = Values> {
  /**
   * Node 使用的稳定 key。
   */
  readonly key: string
  /**
   * 字段路径。
   */
  readonly name: NamePath<TValues>
  /**
   * Renderer 类型。
   */
  readonly componentType: SchemxResolvedBaseField<TValues>["componentType"]
  /**
   * 字段标签。
   */
  readonly label: string
  /**
   * 字段及其后代是否可见。
   */
  readonly visible: boolean
  /**
   * 字段及其后代是否禁用。
   */
  readonly disabled: boolean
  /**
   * 字段及其后代是否只读。
   */
  readonly readonly: boolean
  /**
   * 字段的最终必填配置。
   */
  readonly required: SchemxResolvedBaseField<TValues>["required"]
  /**
   * 是否显示必填标记。
   */
  readonly showRequiredMark: boolean
  /**
   * 可编辑状态下使用的 placeholder。
   */
  readonly placeholder: string
  /**
   * 只读状态下使用的 placeholder。
   */
  readonly readonlyPlaceholder?: string
  /**
   * 传给 Renderer 的最终 Props。
   */
  readonly componentProps: SchemxComponentProps<TValues>
  /**
   * Validator 执行的最终规则声明。
   */
  readonly rules: FieldRules<TValues, NamePath<TValues>>
  /**
   * 字段校验触发时机。
   */
  readonly validationTrigger: SchemxResolvedBaseField<TValues>["validationTrigger"]
}

/**
 * Validator 消费的字段校验配置切片。
 *
 * 该切片不包含 Renderer Props 等与校验无关的展示配置。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldValidationSchema<TValues extends Values = Values> {
  /**
   * 字段及其后代是否可见。
   */
  readonly visible: boolean
  /**
   * 字段及其后代是否只读。
   */
  readonly readonly: boolean
  /**
   * 字段及其后代是否禁用。
   */
  readonly disabled: boolean
  /**
   * Validator 使用的字段标签。
   */
  readonly label: string
  /**
   * 字段的最终必填配置。
   */
  readonly required: SchemxResolvedBaseField<TValues>["required"]
  /**
   * 字段的最终规则声明。
   */
  readonly rules: FieldRules<TValues, NamePath<TValues>>
}

/**
 * 字段动态覆盖更新的诊断元数据。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface DynamicOverrideMeta<TValues extends Values = Values> {
  /**
   * 动态覆盖的来源。
   */
  readonly source: "dependencies"
  /**
   * 触发本次覆盖解析的字段路径。
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 解析或执行覆盖时产生的错误。
   */
  readonly error?: Error | null
}

/**
 * 所有 Node 共享的结构字段。
 */
interface BaseNode<TValues extends Values = Values> {
  /**
   * Node 内部稳定 id。
   */
  readonly id: NodeId

  /**
   * 用于 keyed reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: NodeType

  /**
   * 父 Node。
   *
   * root 节点没有 parent（值为 null）。
   */
  parent: ContainerNode<TValues> | null

  /**
   * Node 自身的完整生命周期边界。
   *
   * 当 node 被 reconcile 移除时调用 dispose()。
   */
  scope: Scope

  /**
   * 节点是否已经进入销毁流程。
   */
  readonly disposed: Signal<boolean>

  /**
   * 节点投影到渲染层的 ViewSchema 列表；未挂载时为 `null`。
   */
  viewSchemas: ComputedSignal<readonly SchemxViewSchema<TValues>[]> | null
}

/**
 * RootNode - 透明根节点。
 *
 * Root 不对应任何 schema，只负责承载顶层 children。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface RootNode<TValues extends Values = Values> extends BaseNode<TValues> {
  /**
   * 根节点类型标记。
   */
  readonly type: "root"

  /**
   * 根节点没有父节点，始终为 `null`。
   */
  parent: null

  /**
   * 顶层 runtime 子节点。
   */
  readonly childNodes: Signal<readonly SchemaNode<TValues>[]>
}

/**
 * FieldNode - 字段节点。
 *
 * Field 不承载结构子节点，已解析配置和运行态直接挂在 node 上。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldNode<TValues extends Values = Values> extends BaseNode<TValues> {
  /**
   * 字段节点类型标记。
   */
  readonly type: "field"

  /**
   * 字段节点的父容器；根字段的 `parent` 为 `null`。
   */
  parent: ParentNode<TValues> | null

  /**
   * 当前字段配置的身份令牌；配置变化时由 Compiler 重新生成。
   */
  configToken: symbol

  /**
   * 字段路径。
   */
  readonly name: Signal<NamePath<TValues>>

  /**
   * 编译后的字段静态配置。
   */
  readonly staticSchema: Signal<SchemxBaseField<TValues>>

  /**
   * 字段 dependencies 产生的动态覆盖结果。
   */
  readonly dynamicOverrides: Signal<FieldDynamicOverrides<TValues>>

  /**
   * 字段合并静态配置、动态覆盖和祖先状态后的最终配置。
   */
  readonly effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>

  /**
   * Validator 消费的校验配置切片。
   */
  readonly validationSchema: ComputedSignal<FieldValidationSchema<TValues>>

  /**
   * 字段运行时诊断信息；未开启 debug 时为 `undefined`。
   */
  readonly diagnostics?: Signal<FieldRuntimeDiagnostics<TValues>>

  /**
   * 字段校验 effect 使用的资源作用域。
   */
  validationEffectScope: Scope | null

  /**
   * 仅管理字段 dependencies effect 的独立资源作用域。
   */
  dependenciesEffectScope: Scope | null
}

/**
 * GroupNode - 分组节点。
 *
 * Group 负责 schema 结构嵌套，通过 childNodes 承载静态编译后的子节点。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface GroupNode<TValues extends Values = Values> extends BaseNode<TValues> {
  /**
   * 分组节点类型标记。
   */
  readonly type: "group"

  /**
   * 分组节点的父容器；根分组的 `parent` 为 `null`。
   */
  parent: ParentNode<TValues> | null

  /**
   * 当前分组配置的身份令牌。
   */
  configToken: symbol

  /**
   * 编译后的分组静态配置。
   */
  readonly staticSchema: Signal<SchemxGroupField<TValues>>

  /**
   * 分组 dependencies 产生的动态呈现覆盖。
   */
  readonly dynamicOverrides: Signal<PresentationDynamicOverrides>

  /**
   * 分组继承祖先状态并合并自身配置后的呈现状态。
   */
  readonly effectiveState: ComputedSignal<PresentationStaticState>

  /**
   * 分组呈现 effect 使用的资源作用域。
   */
  presentationEffectScope: Scope | null

  /**
   * 静态 schema children 编译后的 runtime 子节点。
   */
  readonly childNodes: Signal<readonly SchemaNode<TValues>[]>
}

/**
 * DependencyNode - 动态 dependency 节点。
 *
 * Dependency 的 children 来自 renderer 动态产物，而非静态编译。
 * 额外持有 rendererEffect，用于管理动态 renderer 的执行状态与生命周期。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface DependencyNode<
  TValues extends Values = Values,
> extends BaseNode<TValues> {
  /**
   * 依赖节点类型标记。
   */
  readonly type: "dependency"

  /**
   * 依赖节点的父容器；根依赖的 `parent` 为 `null`。
   */
  parent: ParentNode<TValues> | null

  /**
   * 当前 dependency 配置的身份令牌。
   */
  configToken: symbol

  /**
   * 编译后的 dependency 静态配置。
   */
  readonly staticSchema: Signal<SchemxDependencyField<TValues>>

  /**
   * 依赖节点呈现 dependencies 产生的动态覆盖。
   */
  readonly dynamicOverrides: Signal<PresentationDynamicOverrides>

  /**
   * 依赖节点继承祖先状态并合并自身配置后的呈现状态。
   */
  readonly effectiveState: ComputedSignal<PresentationStaticState>

  /**
   * 动态 renderer 的执行状态与资源作用域。
   */
  rendererEffect: DependencyRendererEffect | null

  /**
   * 依赖节点呈现 effect 使用的资源作用域。
   */
  presentationEffectScope: Scope | null

  /**
   * dependency renderer 产出的动态 runtime 子节点。
   */
  readonly childNodes: Signal<readonly SchemaNode<TValues>[]>
}

/**
 * 所有 Node 的联合类型。
 *
 * @typeParam TValues - 表单值类型。
 */
export type ContainerNode<TValues extends Values = Values> =
  RootNode<TValues> | FieldNode<TValues> | GroupNode<TValues> | DependencyNode<TValues>

/**
 * 除 root 外，所有由 schema 创建的 Node。
 *
 * 即 FieldNode | GroupNode | DependencyNode。
 *
 * @typeParam TValues - 表单值类型。
 */
export type SchemaNode<TValues extends Values = Values> =
  FieldNode<TValues> | GroupNode<TValues> | DependencyNode<TValues>

/**
 * 可以承载子节点的 Node。
 *
 * 即 RootNode | GroupNode | DependencyNode。
 * field 节点没有子节点。
 *
 * @typeParam TValues - 表单值类型。
 */
export type ParentNode<TValues extends Values = Values> =
  RootNode<TValues> | GroupNode<TValues> | DependencyNode<TValues>

/**
 * RootNode 创建选项。
 */
export interface CreateRootNodeOptions {
  /**
   * 根节点使用的资源作用域。
   */
  scope: Scope
}

/**
 * FieldNode 创建选项。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFieldNodeOptions<TValues extends Values = Values> {
  /**
   * 分配给字段节点的稳定 id。
   */
  id: NodeId
  /**
   * 节点的稳定 key。
   */
  key: string
  /**
   * 当前节点配置的身份令牌。
   */
  configToken: symbol
  /**
   * 字段路径。
   */
  name: NamePath<TValues>
  /**
   * 编译后的字段静态配置。
   */
  staticSchema: SchemxBaseField<TValues>
  /**
   * 是否创建字段 diagnostics Signal。
   */
  debug?: boolean
  /**
   * 字段节点使用的资源作用域；省略时创建独立作用域。
   */
  scope?: Scope
}

/**
 * GroupNode 创建选项。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateGroupNodeOptions<TValues extends Values = Values> {
  /**
   * 分配给分组节点的稳定 id。
   */
  id: NodeId
  /**
   * 节点的稳定 key。
   */
  key: string
  /**
   * 当前节点配置的身份令牌。
   */
  configToken: symbol
  /**
   * 编译后的分组静态配置。
   */
  staticSchema: SchemxGroupField<TValues>
  /**
   * 分组节点使用的资源作用域；省略时创建独立作用域。
   */
  scope?: Scope
}

/**
 * DependencyNode 创建选项。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateDependencyNodeOptions<TValues extends Values = Values> {
  /**
   * 分配给依赖节点的稳定 id。
   */
  id: NodeId
  /**
   * 节点的稳定 key。
   */
  key: string
  /**
   * 当前节点配置的身份令牌。
   */
  configToken: symbol
  /**
   * 编译后的 dependency 静态配置。
   */
  staticSchema: SchemxDependencyField<TValues>
  /**
   * 依赖节点使用的资源作用域；省略时创建独立作用域。
   */
  scope?: Scope
}
