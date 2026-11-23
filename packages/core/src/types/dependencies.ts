/**
 * 依赖对象类型定义
 *
 * 定义结构化的依赖配置接口，所有动态属性共享同一组 triggerFields，
 * 当任一触发字段变化时执行已配置的条件函数。
 *
 * @module types/dependencies
 */

import type { NamePath, SchemxFormApi, Values } from "./form"
import type { SchemxBase } from "./schema"

/**
 * 条件函数类型
 *
 * 接收当前表单值，返回属性的计算结果（支持同步和异步）。
 *
 * @typeParam T - 表单值类型
 * @typeParam R - 返回值类型
 */
export type SchemxConditionFn<T extends Values = Values, R = unknown> = (
  values: T,
  form: SchemxFormApi<T>
) => R | Promise<R>

/**
 * 结构化依赖配置对象
 *
 * 所有条件函数共享同一个 `triggerFields`，当任一触发字段变化时，
 * 执行所有已配置的条件函数并更新对应属性值。
 *
 * @typeParam T - 表单值类型
 * @typeParam K - 渲染器组件类型键，用于收窄 componentProps 的类型
 *
 * @example
 * ```ts
 * const deps: SchemxDependencies<MyForm> = {
 *   triggerFields: ['province', 'country'],
 *   visible: (values) => !!values.province,
 *   disabled: (values) => values.country === 'overseas',
 *   placeholder: (values) => `请选择${values.province}的城市`,
 *   trigger: (values) => {
 *     // 副作用逻辑
 *   },
 *   rules: () => ["required"],
 * }
 * ```
 */
export interface SchemxDependencies<T extends Values = Values> {
  /**
   * 触发所有条件函数重新执行的字段路径数组
   *
   * 当数组中任一字段的值发生变化时，所有已配置的条件函数将被重新执行。
   * 支持嵌套路径语法，如 `'user.address.city'`。
   */
  triggerFields: NamePath<T>[]

  /**
   * 传递给渲染组件的属性
   *
   * 条件函数返回 {@link SchemxComponentProps} 类型，
   * 根据 `componentType` 自动收窄为对应组件的 Props 类型。
   * 未配置时使用 {@link SchemxBase.componentProps} 的静态默认值。
   */
  componentProps?: SchemxConditionFn<T, NonNullable<SchemxBase<T>["componentProps"]>>

  /**
   * 占位提示文本
   *
   * 条件函数返回 `string` 类型，用于动态计算输入框的占位文本。
   * 未配置时使用 {@link SchemxBase.placeholder} 的静态默认值。
   */
  placeholder?: SchemxConditionFn<T, NonNullable<SchemxBase<T>["placeholder"]>>

  /**
   * 是否必填
   *
   * 条件函数返回 `boolean` 类型，控制必填标记（红色星号）的显示。
   * 未配置时使用 {@link SchemxBase.required} 的静态默认值。
   */
  required?: SchemxConditionFn<T, NonNullable<SchemxBase["required"]>>

  /**
   * 是否只读
   *
   * 条件函数返回 `boolean` 类型，只读状态下字段可见但不可编辑。
   * 未配置时使用 {@link SchemxBase.readonly} 的静态默认值。
   */
  readonly?: SchemxConditionFn<T, NonNullable<SchemxBase<T>["readonly"]>>

  /**
   * 是否禁用
   *
   * 条件函数返回 `boolean` 类型，禁用状态下字段不可交互。
   * 未配置时使用 {@link SchemxBase.disabled} 的静态默认值。
   */
  disabled?: SchemxConditionFn<T, NonNullable<SchemxBase<T>["disabled"]>>

  /**
   * 是否可见
   *
   * 条件函数返回 `boolean` 类型，不可见时字段不渲染，
   * 同时会清除校验规则和错误信息。
   * 未配置时使用 {@link SchemxBase.visible} 的静态默认值。
   */
  visible?: SchemxConditionFn<T, NonNullable<SchemxBase<T>["visible"]>>

  /**
   * 校验规则
   *
   * 条件函数返回 `SchemxRules | SchemxRules[]` 类型，用于动态计算字段的校验规则。
   * 未配置时使用 {@link SchemxBase.rules} 的静态默认值。
   */
  rules?: SchemxConditionFn<T, SchemxBase<T>["rules"]>

  /**
   * 副作用触发器
   *
   * 条件函数返回 `void` 类型，仅用于执行副作用逻辑（如联动清空、远程请求）。
   * 与其他条件函数并行执行，异常独立捕获不影响属性解析。
   */
  trigger?: SchemxConditionFn<T, void>
}

/**
 * 可解析的属性键（不含 triggerFields 和 trigger）
 *
 * 用于约束 defaults 对象的键值范围。
 */
export type SchemxDependenciesConditionKey = Exclude<
  keyof SchemxDependencies,
  "triggerFields" | "trigger"
>

/**
 * 从 SchemxDependencies 中提取各属性的静态返回类型
 *
 * 排除 `triggerFields`（配置字段）和 `trigger`（void 无静态值意义），
 * 将每个 `SchemxConditionFn<T, R>` 映射为 `R`。
 *
 * @typeParam T - 表单值类型
 * @typeParam K - 渲染器组件类型键
 *
 * @example
 * ```ts
 * // 等价于：
 * // {
 * //   componentProps: SchemxComponentProps<T, K>
 * //   placeholder: string
 * //   required: boolean
 * //   readonly: boolean
 * //   disabled: boolean
 * //   visible: boolean
 * // }
 * type Defaults = SchemxDependenciesStaticProps<MyForm>
 * ```
 */
export type SchemxDependenciesStaticProps<T extends Values = Values> = {
  [P in SchemxDependenciesConditionKey]-?: SchemxDependencies<T>[P] extends
    | SchemxConditionFn<T, infer R>
    | undefined
    ? R
    : never
}
