/**
 * Schema 基础和公开类型
 *
 * 定义 Schema 的基础组合类型，以及对外公开的字段联合类型。
 *
 * @module types/schema
 */

import type {
  NamePath,
  SchemxBaseFieldByName,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxGroupField,
  Values,
} from "./index"

/**
 * 字段配置联合类型
 *
 * 表单 schemas 数组中每个元素的类型。
 * 普通字段仅按 Renderer 展开，避免与字段路径生成规模过大的笛卡尔联合。
 *
 * @typeParam  TValues - 表单值类型
 */
export type SchemxField<TValues extends Values = Values> =
  | SchemxBaseFieldByName<TValues, NamePath<TValues>>
  | SchemxGroupField<TValues>
  | SchemxDependencyField<TValues>
  | SchemxDynamicField<TValues>
