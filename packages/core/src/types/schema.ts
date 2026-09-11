/**
 * Schema 基础和公开类型
 *
 * 定义 Schema 的基础组合类型，以及对外公开的字段联合类型。
 *
 * @module types/schema
 */

import type { SchemxDependencyField } from "./dependency"
import type { SchemxDynamicField } from "./dynamic"
import type { SchemxBase } from "./field"
import type { NamePath, Values } from "./form"
import type { SchemxGroupField } from "./group"
import type { SchemxRendererDefinition } from "./renderer"

/**
 * Schema 数组使用的 Renderer 判别联合。
 *
 * 仅按 Renderer 展开，避免与字段路径生成规模过大的笛卡尔联合。
 */
type SchemxRendererField<TValues extends Values> = [
  Extract<keyof SchemxRendererDefinition<TValues>, string>,
] extends [never]
  ? SchemxBase<TValues, NamePath<TValues>, string>
  : {
      [TKey in Extract<keyof SchemxRendererDefinition<TValues>, string>]: SchemxBase<
        TValues,
        NamePath<TValues>,
        TKey
      >
    }[Extract<keyof SchemxRendererDefinition<TValues>, string>]

/**
 * 字段配置联合类型
 *
 * 表单 schemas 数组中每个元素的类型。
 *
 * @typeParam  TValues - 表单值类型
 */
export type SchemxField<TValues extends Values = Values> =
  | SchemxRendererField<TValues>
  | SchemxGroupField<TValues>
  | SchemxDependencyField<TValues>
  | SchemxDynamicField<TValues>
