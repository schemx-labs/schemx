/**
 * ViewSchema 类型定义。
 *
 * ViewSchema 是渲染层消费的 schema 快照：它保留 SchemxField 的渲染结构，
 * 但只包含 core 已处理好的静态渲染数据。dependency schema 会被透明展开，
 * Dynamic schema 会保留数组行边界。
 *
 * @module core/runtime/view/types
 */

import type {
  SchemxBaseField,
  SchemxDynamicField,
  SchemxGroupField,
  Values,
} from "../../types"
import type { FieldDynamicOverrideKey } from "../node"

/**
 * 对联合类型逐项执行 Omit。
 *
 * TypeScript 内置的 `Omit<TSource, TKey>` 直接作用在联合类型上时会先合并成员公共属性，
 * 这里通过条件类型触发 distributive behavior，保留每个 schema 分支各自的字段。
 *
 * @typeParam TSource - 要处理的源类型，支持联合类型。
 * @typeParam TKey - 要从每个联合成员中移除的属性 key。
 */
type DistributiveOmit<TSource, TKey extends PropertyKey> = TSource extends unknown
  ? Omit<TSource, TKey>
  : never

/**
 * ViewSchema 调试元数据。
 *
 * 附着在每个 ViewSchema 上，记录运行时节点 id、类型、依赖覆盖来源等信息，
 * 方便开发环境定位 schema 的来源与变更历史。
 */
export interface SchemxViewDebugMeta {
  /**
   * 运行时节点唯一标识
   */
  readonly runtimeNodeId: number
  /**
   * 运行时节点类型（field / group / dynamic）。
   */
  readonly runtimeNodeType: string
  /**
   * 该节点是否拥有字段或容器运行时状态
   */
  readonly hasRuntimeState: boolean
  /**
   * 该节点是否受 dependency 影响
   */
  readonly hasDependencyEffect: boolean
  /**
   * 最近一次动态覆盖的来源标识
   */
  readonly lastUpdatedBy?: "static-schema" | "dependencies" | "reset" | "dispose"
  /**
   * 最近一次动态覆盖涉及的字段属性 key 列表
   */
  readonly overriddenKeys?: readonly FieldDynamicOverrideKey[]
  /**
   * 最近一次解析错误信息，无错误时为 null
   */
  readonly error?: string | null
}

/**
 * 字段 ViewSchema。
 *
 * 字段项保持 SchemxField 的扁平格式，动态依赖结果已经合并为静态值。
 * Omit 掉 "key" 和 "dependencies" 后由运行时节点重新注入运行时字段。
 */
export type SchemxViewFieldSchema<TValues extends Values = Values> = DistributiveOmit<
  SchemxBaseField<TValues>,
  "key" | "dependencies"
> & {
  /**
   * 运行时节点 key，形如 "field:name"
   */
  readonly key: string
  /**
   * 最终是否显示必填视觉标记。
   *
   * 该值已按动态配置、静态配置和有效 `required` 的顺序完成解析，
   * 只供渲染层展示，不代表是否注册必填校验。
   */
  readonly showRequiredMark: boolean
  /**
   * 调试元数据，开发环境用于追踪 schema 来源
   */
  readonly debug?: Readonly<SchemxViewDebugMeta>
}

/**
 * 分组 ViewSchema。
 *
 * group 继续以 children 表达结构层级，children 中不会包含 dependency schema。
 * Omit 掉 "key"、"children" 和 "dependencies" 后由运行时节点重新注入。
 */
export type SchemxViewGroupSchema<TValues extends Values = Values> = DistributiveOmit<
  SchemxGroupField<TValues>,
  "key" | "children" | "dependencies"
> & {
  /**
   * 运行时节点 key，形如 "group:0"
   */
  readonly key: string
  /**
   * 子级 ViewSchema 列表，dependency schema 已透明展开
   */
  readonly children: readonly SchemxViewSchema<TValues>[]
  /**
   * 调试元数据
   */
  readonly debug?: Readonly<SchemxViewDebugMeta>
}

/**
 * Dynamic 数组 ViewSchema 的行投影。
 *
 * `key` 来自 FieldArray 的稳定行身份，`index` 是当前路径展开所使用的索引。
 */
export interface SchemxViewDynamicItem<TValues extends Values = Values> {
  /**
   * 当前数组行的稳定 key。
   */
  readonly key: string
  /**
   * 当前数组行索引。
   */
  readonly index: number
  /**
   * 当前行展开后的字段与 Group。
   */
  readonly children: readonly SchemxViewSchema<TValues>[]
}

/**
 * Dynamic 数组 ViewSchema。
 *
 * Raw Schema 的 `item` 模板在这里按 FieldArray 行展开为 `items`，避免与 Group
 * ViewSchema 的 `children` 结构混淆。
 */
export type SchemxViewDynamicSchema<TValues extends Values = Values> = Omit<
  SchemxDynamicField<TValues>,
  "item" | "dependencies"
> & {
  /**
   * Dynamic 节点的稳定运行时 key。
   */
  readonly key: string
  /**
   * 当前数组的行投影。
   */
  readonly items: readonly SchemxViewDynamicItem<TValues>[]
  /**
   * Dynamic 容器是否可见。
   */
  readonly visible: boolean
  /**
   * Dynamic 容器是否只读。
   */
  readonly readonly: boolean
  /**
   * Dynamic 容器是否禁用。
   */
  readonly disabled: boolean
  /**
   * 调试元数据。
   */
  readonly debug?: Readonly<SchemxViewDebugMeta>
}

/**
 * 渲染层消费的 schema 联合类型。
 *
 * 渲染层只需遍历此类型数组即可完成表单渲染，无需关心 dependency schema 的处理。
 */
export type SchemxViewSchema<TValues extends Values = Values> =
  | SchemxViewFieldSchema<TValues>
  | SchemxViewGroupSchema<TValues>
  | SchemxViewDynamicSchema<TValues>
