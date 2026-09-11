/**
 * Dynamic Schema 类型定义。
 *
 * 定义动态数组容器及其数组项模板类型。
 *
 * @module types/dynamic
 */

import type { SchemxDynamicDependencies } from "./dependencies"
import type { SchemxDependencyField, SchemxDependencyRendererContext } from "./dependency"
import type { SchemxExactBaseField } from "./field"
import type { FieldValue, NamePath, Values } from "./form"
import type { SchemxGroupField } from "./group"
import type { SchemxFormApi } from "./instance"
import type { SchemxLayout } from "./layout"

/**
 * 从数组字段值中提取单行类型。
 *
 * @typeParam TValue - 需要解析的字段值类型。
 */
export type FieldArrayItemValue<TValue> = TValue extends null | undefined
  ? never
  : TValue extends readonly (infer TItem)[]
    ? TItem
    : never

// 将对象属性追加到当前字段路径。
type JoinFieldArrayPath<TPrefix extends string, TKey extends string> = TPrefix extends ""
  ? TKey
  : `${TPrefix}.${TKey}`

// 判断类型中是否包含数组成员，用于继续递归查找候选路径。
type HasArrayMember<TValue> =
  Extract<NonNullable<TValue>, readonly unknown[]> extends never ? false : true

// 只接受长度可变的数组，排除 tuple 和固定长度数组。
type IsDynamicArray<TValue> = [NonNullable<TValue>] extends [readonly unknown[]]
  ? number extends NonNullable<TValue>["length"]
    ? true
    : false
  : false

/**
 * 递归提取不经过数组索引的动态数组路径。
 *
 * 递归深度限制为 5 层，避免复杂表单类型导致类型计算失控。
 */
type FieldArrayPathInner<
  TValue,
  TPrefix extends string = "",
  TDepth extends unknown[] = [],
> = TDepth["length"] extends 5
  ? never
  : HasArrayMember<TValue> extends true
    ? IsDynamicArray<TValue> extends true
      ? TPrefix
      : never
    : [NonNullable<TValue>] extends [object]
      ? {
          [TKey in keyof NonNullable<TValue> & string]: FieldArrayPathInner<
            NonNullable<NonNullable<TValue>[TKey]>,
            JoinFieldArrayPath<TPrefix, TKey>,
            [...TDepth, 1]
          >
        }[keyof NonNullable<TValue> & string]
      : never

/**
 * 仅允许指向动态数组值的字段路径。
 *
 * @typeParam TValues - 表单值类型。
 */
export type FieldArrayPath<TValues extends Values> = Extract<
  FieldArrayPathInner<TValues>,
  NamePath<TValues>
>

/**
 * 数组结构提交影响的索引范围。
 */
export interface FieldArrayRange {
  /**
   * 受影响范围的起始索引，包含该索引。
   */
  readonly start: number
  /**
   * 受影响范围的结束索引，包含该索引。
   */
  readonly end: number
}

/**
 * 数组结构提交的内部变更描述。
 *
 * 该类型只供 Store、Runtime 和校验实现使用，不属于 Core 根入口的公开 API。
 */
export interface FieldArrayChange {
  /**
   * 结构提交前的数组长度。
   */
  readonly previousLength: number
  /**
   * 结构提交后的数组长度。
   */
  readonly nextLength: number
  /**
   * 需要清理字段状态或校验结果的包含边界索引范围。
   */
  readonly ranges: readonly FieldArrayRange[]
  /**
   * reset 或显式根移除是否强制重新生成全部 key。
   */
  readonly resetKeys?: boolean
}

/**
 * 自定义 Schema 基础字段扩展接口
 *
 * 空接口占位，供业务方通过 TypeScript 声明合并（declaration merging）
 * 向 {@link SchemxBase} 注入额外的自定义字段。
 *
 * @example
 * ```ts
 * declare module '@schemx/core' {
 *   interface SchemxDynamicDefinition {
 *     tooltip?: string
 *     span?: number
 *   }
 * }
 * ```
 *
 * 扩展属性会作为静态 Schema 元数据保留，并透传到 Dynamic ViewSchema；
 * 声明扩展属性不会自动增加 dependencies 可动态覆盖的属性。
 */
export interface SchemxDynamicDefinition {}

/**
 * Dynamic 数组项可以由普通字段、Group 和 Dependency 组成。
 *
 * @typeParam TItem - 数组项对象类型。
 * @typeParam TValues - 完整表单值类型。
 */
export type SchemxDynamicItemSchema<
  TItem extends Values,
  TValues extends Values = TItem,
> =
  | SchemxExactBaseField<TItem>
  | SchemxDynamicItemGroup<TItem, TValues>
  | SchemxDynamicItemDependency<TItem, TValues>

/**
 * Dynamic 数组项中的 Group。
 *
 * Group 的子项继续沿用数组项的相对路径。
 *
 * @typeParam TItem - 数组项对象类型。
 * @typeParam TValues - 完整表单值类型。
 */
export type SchemxDynamicItemGroup<
  TItem extends Values,
  TValues extends Values = TItem,
> = Omit<SchemxGroupField<TItem>, "children"> & {
  /**
   * 当前 Group 的数组项子模板。
   */
  children: SchemxDynamicItemSchema<TItem, TValues>[]
}

/**
 * Dynamic 行内 Dependency renderer 的执行上下文。
 *
 * `to` 与 Dependency 自身的 `dependencies.triggerFields` 仍使用完整表单路径；
 * renderer 返回的 Field、Group 和 Dependency 才使用当前行的相对路径。
 *
 * @typeParam TItem - 数组项对象类型。
 * @typeParam TValues - 完整表单值类型。
 */
export interface SchemxDynamicItemDependencyRendererContext<
  TItem extends Values,
  TValues extends Values = TItem,
> extends SchemxDependencyRendererContext {
  /**
   * 当前 Dynamic 行的值快照。
   */
  readonly item: TItem
  /**
   * 当前 Dynamic 行的稳定运行时 key。
   */
  readonly rowKey: string
  /**
   * 当前 Dynamic 行的数组索引。
   */
  readonly rowIndex: number
  /**
   * 当前 Dynamic 行的完整路径。
   */
  readonly rowPath: NamePath<TValues>
}

/**
 * Dynamic 行内 Dependency Schema。
 *
 * `to` 和 `dependencies.triggerFields` 复用普通 Dependency 的完整路径规则；
 * renderer 产生的子 Schema 按当前 Dynamic 行展开。
 *
 * @typeParam TItem - 数组项对象类型。
 * @typeParam TValues - 完整表单值类型。
 * @typeParam TNames - Dependency 的完整触发路径类型。
 */
export type SchemxDynamicItemDependency<
  TItem extends Values,
  TValues extends Values = TItem,
  TNames extends readonly NamePath<TValues>[] = readonly NamePath<TValues>[],
> = Omit<SchemxDependencyField<TValues, TNames>, "renderer"> & {
  renderer: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: SchemxDynamicItemDependencyRendererContext<TItem, TValues>
  ) =>
    | SchemxDynamicItemSchema<TItem, TValues>[]
    | Promise<SchemxDynamicItemSchema<TItem, TValues>[]>
}

/**
 * 从表单类型中提取 Dynamic 数组项的对象类型。
 *
 * 基本类型数组不会得到可供子字段使用的对象项类型。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TPath - Dynamic 数组路径。
 */
export type SchemxDynamicItemValue<
  TValues extends Values,
  TPath extends NamePath<TValues>,
> = Extract<
  NonNullable<FieldArrayItemValue<FieldValue<TValues, TPath>>>,
  Values
>

/**
 * 只允许对象数组作为 Dynamic Schema 的数组路径。
 *
 * @typeParam TValues - 表单值对象类型。
 */
type DynamicObjectArrayPath<TValues extends Values> = {
  [TPath in FieldArrayPath<TValues>]: [SchemxDynamicItemValue<TValues, TPath>] extends [never]
    ? never
    : TPath
}[FieldArrayPath<TValues>]

/**
 * 只允许对象数组作为 Dynamic Schema 的数组路径。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export type SchemxDynamicArrayPath<TValues extends Values> =
  DynamicObjectArrayPath<TValues>

/**
 * Dynamic Schema 的数组根路径。
 *
 * 未指定具体表单结构时保留字符串路径推导，供通用 `SchemxField` 默认类型使用；
 * 传入具体表单类型时收窄为对象数组路径。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export type SchemxDynamicNamePath<TValues extends Values> = string extends keyof TValues
  ? string
  : SchemxDynamicArrayPath<TValues>

/**
 * Dynamic 字段定义。
 *
 * Core 层只负责：
 * - 数组数据结构
 * - item runtime 创建与复用
 * - 增删移动
 * - namePath / index 更新
 * - 状态与约束解析
 *
 * 不负责新增按钮、删除按钮、拖拽、布局等 UI 行为。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TItem - 数组项对象类型。
 */
export interface SchemxDynamicField<
  TValues extends Values = Values,
  TItem extends Values = Values,
> extends SchemxDynamicDefinition {
  /**
   * Dynamic Schema 的稳定标识键，必须由调用方提供。
   *
   * Core 会沿用该 key 生成行模板的运行时节点 key，供框架层保持数组行身份。
   */
  key: string

  /**
   * 对应 values 中的数组路径。
   */
  name: SchemxDynamicNamePath<TValues>

  /**
   * 展示名称。
   *
   * @deprecated Dynamic 展示配置由 UI 适配层拥有；兼容期间仍保留。
   */
  label?: string

  /**
   * Dynamic 容器在 24 栅格布局容器中的静态布局配置。
   *
   * Core 会将该配置透传到 Dynamic ViewSchema；具体的布局组件由适配层解释。
   *
   * @deprecated 请从 UI 适配层使用 Dynamic 布局定义。
   */
  layout?: SchemxLayout

  /**
   * 每个数组 item 复用的 Schema 模板。
   */
  item: SchemxDynamicItemSchema<TItem, TValues>[]

  /**
   * 是否可见。
   *
   * 不可见时整个后代子树停止校验，但保留字段值。
   */
  visible?: boolean

  /**
   * 是否强制后代字段只读。
   */
  readonly?: boolean

  /**
   * 是否强制后代字段禁用。
   */
  disabled?: boolean

  /**
   * 根据表单值动态覆盖 Dynamic 容器的呈现状态。
   */
  dependencies?: SchemxDynamicDependencies<TValues>
}
