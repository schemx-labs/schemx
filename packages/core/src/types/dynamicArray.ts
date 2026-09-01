import { SchemxDynamicDependencies } from "./dependencies"
import { NamePath, Values } from "./form"
import { SchemxField } from "./schema"

/**
 * DynamicArray item 的稳定 key。
 */
export type SchemxDynamicArrayItemKey = string | number

/**
 * DynamicArray 字段定义。
 *
 * Core 层只负责：
 * - 数组数据结构
 * - item runtime 创建与复用
 * - 增删移动
 * - namePath / index 更新
 * - 状态与约束解析
 *
 * 不负责新增按钮、删除按钮、拖拽、布局等 UI 行为。
 */
export interface SchemxDynamicArrayField<
  TValues extends Values = Values,
  TItem = unknown,
> extends SchemxDynamicDependencies<TValues> {
  /**
   * Schema 类型。
   */
  readonly type: "dynamicArray"

  /**
   * 对应 values 中的数组路径。
   */
  readonly name: NamePath<TValues>

  /**
   * 展示名称。
   */
  readonly label?: string

  /**
   * 每个数组 item 复用的 Schema 模板。
   */
  readonly children: readonly SchemxField<TValues>[]

  /**
   * 获取 item 的稳定身份。
   *
   * 用于 RuntimeNode 复用以及 move/remove 等操作。
   * 不应使用数组 index 作为稳定 key。
   */
  readonly getItemKey?: (item: TItem, index: number) => SchemxDynamicArrayItemKey

  /**
   * 新增 item 时使用的默认值。
   */
  readonly defaultItem?: TItem | (() => TItem)

  /**
   * 最小 item 数量。
   */
  readonly minItems?: number

  /**
   * 最大 item 数量。
   */
  readonly maxItems?: number
}
