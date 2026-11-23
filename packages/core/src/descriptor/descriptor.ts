/**
 * 表单描述符类型，用于 schema 编译。
 *
 * 描述符是编译后的中间表示，不持有实例状态。
 * 它们由 schema compiler 生成，被表单内部 node 消费以创建字段模型。
 *
 * @module core/descriptor/descriptor
 */

import type {
  NamePath,
  SchemxDependencies,
  SchemxField,
  SchemxFormApi,
  SchemxRendererKey,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  Values,
} from "../types"

/**
 * 表单描述符，所有描述符类型的联合类型。
 *
 * 描述符树表示 schema 编译后的表单结构，在 node 实例化之前。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export type FormDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> =
  | FieldDescriptor<TValues>
  | GroupDescriptor<TValues, TName>
  | DependencyDescriptor<TValues, TName>

/**
 * 字段描述符，描述单个表单字段。
 *
 * 包含：
 * - 身份：key 用于协调
 * - Schema：schema 是规范化后的静态字段 schema
 * - Dependencies：dependencies 是字段动态派生规则
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldDescriptor<TValues extends Values = Values> {
  /**
   * 描述符类型标识，用于区分字段、分组和 dependency。
   */
  readonly type: "field"

  /**
   * 用于 runtime node reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 字段在表单值对象中的名称路径。
   */
  readonly name: NamePath<TValues>

  /**
   * 字段渲染器类型，用于匹配渲染层注册的 renderer。
   */
  readonly rendererType: SchemxRendererKey

  /**
   * 编译后、已补默认值的字段 schema。
   */
  readonly schema: SchemxResolvedBaseField<TValues>

  /**
   * 字段的动态派生规则；不存在时字段使用静态 schema。
   */
  readonly dependencies?: SchemxDependencies<TValues>
}

/**
 * 分组描述符，描述一组字段或嵌套分组。
 *
 * 分组是结构性容器，没有字段状态。
 * 用于布局和组织目的。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface GroupDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 描述符类型标识，用于区分字段、分组和 dependency。
   */
  readonly type: "group"

  /**
   * 用于 runtime node reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 编译后、已补默认值的分组 schema。
   */
  readonly schema: SchemxResolvedGroupField<TValues>

  /**
   * 分组内的子描述符树。
   */
  readonly children: FormDescriptor<TValues, TName>[]
}

/**
 * 依赖描述符，描述由 dependency schema 生成的动态子树。
 *
 * 外部 `componentType: "dependency"` schema 会被编译为该描述符。
 * 当 trigger 字段变化时，render 函数被调用，返回新的 schema，再由 commit 边界前编译。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface DependencyDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 描述符类型标识，用于区分字段、分组和 dependency。
   */
  readonly type: "dependency"

  /**
   * 用于 runtime node reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 触发 dependency renderer 重新执行的字段名路径列表。
   */
  readonly trigger: TName[]

  /**
   * 根据当前表单状态动态生成子 schema 的渲染函数。
   */
  readonly renderer: DependencyRenderer<TValues>
}

/**
 * dependency 描述符渲染函数，动态生成子 schema。
 *
 * @typeParam TValues - 表单值类型
 * @param formApi - 表单 API，用于读取和操作当前表单
 * @param abortSignal - 中止信号，用于取消过期渲染
 * @returns 子树的 schema 数组
 */
export type DependencyRenderer<TValues extends Values = Values> = (
  /**
   * 表单 API，用于程序化操作表单。
   */
  formApi: SchemxFormApi<TValues>,
  /**
   * 中止信号，用于取消渲染器执行。
   */
  abortSignal: AbortSignal
) => Promise<SchemxField<TValues>[]> | SchemxField<TValues>[]

/**
 * 判断是否为字段描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns 字段描述符
 */
export const isFieldDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is FieldDescriptor<TValues> => {
  return descriptor.type === "field"
}

/**
 * 判断是否为分组描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns 分组描述符
 */
export const isGroupDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is GroupDescriptor<TValues> => {
  return descriptor.type === "group"
}

/**
 * 判断是否为 dependency 描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns dependency 描述符
 */
export const isDependencyDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is DependencyDescriptor<TValues> => {
  return descriptor.type === "dependency"
}
