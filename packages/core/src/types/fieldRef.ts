import type { ReadonlyState } from "../reactivity"
import type { FieldState } from "../store"
import type { NamePath, Values } from "./form"

// 引用只能由所属 Form 创建，品牌不承担运行期路径或状态存储。
declare const fieldRefBrand: unique symbol

/**
 * Form 持有的稳定字段身份；引用本身不提供状态、方法或销毁能力。
 * @typeParam TValues - 所属表单值类型。
 * @typeParam TName - 初始路径，用于推导字段值类型。
 */
export interface FieldRef<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 保留表单与初始路径的类型关系，消费端不能自行构造引用。
   */
  readonly [fieldRefBrand]: readonly [TValues, TName]
}

/**
 * Form 对字段引用提供的只读状态，节点失效后统一返回空值和 false。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 引用初始字段路径。
 */
export interface FieldRefState<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends FieldState<TValues, TName> {
  /**
   * 当前地址，失效后为 undefined。
   */
  readonly name: ReadonlyState<NamePath<TValues> | undefined>
  /**
   * 所属 Form 或绑定节点是否已销毁。
   */
  readonly disposed: ReadonlyState<boolean>
}
