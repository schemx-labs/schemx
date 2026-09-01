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
> {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string

  /**
   * 对应 values 中的数组路径。
   */
  name: NamePath<TValues>

  /**
   * 展示名称。
   */
  label?: string

  /**
   * 每个数组 item 复用的 Schema 模板。
   */
  children: SchemxField<TValues>[]

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
   * 根据表单值动态覆盖 Group 的容器状态。
   */
  dependencies?: SchemxDynamicDependencies<TValues>

  /**
   * 获取 item 的稳定身份。
   *
   * 用于 Node 复用以及 move/remove 等操作。
   * 不应使用数组 index 作为稳定 key。
   */
  getItemKey?: (item: TItem, index: number) => SchemxDynamicArrayItemKey

  /**
   * 新增 item 时使用的默认值。
   */
  defaultItem?: TItem | (() => TItem)

  /**
   * 最小 item 数量。
   */
  minItems?: number

  /**
   * 最大 item 数量。
   */
  maxItems?: number
}
