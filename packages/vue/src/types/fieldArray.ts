/**
 * Vue FieldArray 的响应式类型。
 *
 * @module vue/types/fieldArray
 */

import type { ShallowRef } from "vue"

import type {
  FieldArrayField,
  FieldArrayInstance,
  FieldArrayPath,
  Values,
} from "@schemx/core"

/**
 * Vue FieldArray Hook 返回的控制器。
 *
 * `fields` 是只读 shallow ref；其中的 key 只表达渲染身份，不写入表单值。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TPath - 动态数组字段路径。
 */
export interface UseFieldArrayReturn<
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
> extends Omit<FieldArrayInstance<TValues, TPath>, "getFields"> {
  /**
   * 当前数组行结构；每行 key 不会写入表单值。
   */
  readonly fields: Readonly<ShallowRef<readonly FieldArrayField[]>>
}
