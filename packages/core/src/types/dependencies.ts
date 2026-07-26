/**
 * 依赖对象类型定义
 *
 * 定义结构化的依赖配置接口，所有动态属性共享同一组 triggerFields，
 * 当任一触发字段变化时执行已配置的条件函数。
 *
 * @module types/dependencies
 */

import type { NamePath, SchemxFormApi, Values } from "./form"
import type { DefinedFieldValue, FieldRules, RequiredRule } from "./rule"
import type { SchemxBase } from "./schema"

/**
 * 条件函数类型
 *
 * 接收当前表单值，返回属性的计算结果（支持同步和异步）。
 *
 * @typeParam T - 表单值类型
 * @typeParam R - 返回值类型
 * @param values - 条件执行时的当前表单值快照。
 * @param form - 可读取或更新当前表单的公开 API。
 * @returns 属性计算结果或异步结果。
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
 * @typeParam TName - 当前字段路径，用于推导必填判断与校验规则的字段值类型。
 *
 * @example
 * ```ts
 * const deps: SchemxDependencies<MyForm, "city"> = {
 *   triggerFields: ['province', 'country'],
 *   visible: (values) => !!values.province,
 *   disabled: (values) => values.country === 'overseas',
 *   placeholder: (values) => `请选择${values.province}的城市`,
 *   required: (values) => ({
 *     message: `${values.province}的城市不能为空`,
 *     isEmpty: (city) => !city?.trim(),
 *   }),
 *   trigger: (values) => {
 *     // 副作用逻辑
 *   },
 * }
 * ```
 */
export interface SchemxDependencies<
  T extends Values = Values,
  TName extends NamePath<T> = NamePath<T>,
> {
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
  componentProps?: SchemxConditionFn<
    T,
    NonNullable<SchemxBase<T, TName>["componentProps"]>
  >

  /**
   * 占位提示文本
   *
   * 条件函数返回 `string` 类型，用于动态计算输入框的占位文本。
   * 未配置时使用 {@link SchemxBase.placeholder} 的静态默认值。
   */
  placeholder?: SchemxConditionFn<T, NonNullable<SchemxBase<T, TName>["placeholder"]>>

  /**
   * 是否必填
   *
   * 条件函数返回字段对应的 {@link RequiredRule}，控制必填校验；必填视觉标记由
   * `showRequiredMark` 独立控制。对象形式的 `isEmpty` 参数按当前字段路径推导。
   * 未配置时使用 {@link SchemxBase.required} 的静态默认值。
   */
  required?: SchemxConditionFn<T, RequiredRule<DefinedFieldValue<T, TName>>>

  /**
   * 是否显示必填视觉标记。
   *
   * 条件函数返回 `boolean`，只覆盖渲染层的必填标记，不改变动态或静态
   * `required` 校验。未配置静态标记时，标记默认跟随当前有效 `required`。
   */
  showRequiredMark?: SchemxConditionFn<T, boolean>

  /**
   * 是否只读
   *
   * 条件函数返回 `boolean` 类型，只读状态下字段可见但不可编辑。
   * 未配置时使用 {@link SchemxBase.readonly} 的静态默认值。
   */
  readonly?: SchemxConditionFn<T, NonNullable<SchemxBase<T, TName>["readonly"]>>

  /**
   * 占位提示文本 - 只读状态
   *
   * 条件函数返回 `string` 类型，用于动态计算输入框的占位文本。
   * 未配置时使用 {@link SchemxBase.readonlyPlaceholder} 的静态默认值。
   */
  readonlyPlaceholder?: SchemxConditionFn<
    T,
    NonNullable<SchemxBase<T, TName>["readonlyPlaceholder"]>
  >

  /**
   * 是否禁用
   *
   * 条件函数返回 `boolean` 类型，禁用状态下字段不可交互。
   * 未配置时使用 {@link SchemxBase.disabled} 的静态默认值。
   */
  disabled?: SchemxConditionFn<T, NonNullable<SchemxBase<T, TName>["disabled"]>>

  /**
   * 是否可见
   *
   * 条件函数返回 `boolean` 类型，不可见时字段不渲染，
   * 同时会清除校验规则和错误信息。
   * 未配置时使用 {@link SchemxBase.visible} 的静态默认值。
   */
  visible?: SchemxConditionFn<T, NonNullable<SchemxBase<T, TName>["visible"]>>

  /**
   * 校验规则
   *
   * 条件函数返回字段 `rules` 类型，用于动态计算字段的校验规则。
   * 未配置时使用 {@link SchemxBase.rules} 的静态默认值。
   */
  rules?: SchemxConditionFn<T, FieldRules<T, TName> | undefined>

  /**
   * 副作用触发器
   *
   * 条件函数返回 `void` 类型，仅用于执行副作用逻辑（如联动清空、远程请求）。
   * 与其他条件函数并行执行，异常独立捕获不影响属性解析。
   */
  trigger?: SchemxConditionFn<T, void>
}

/**
 * 容器节点的结构化依赖配置。
 *
 * Group 和 Dependency 通过该配置动态控制整棵后代子树的呈现状态。
 * 容器不支持字段专属的 componentProps、placeholder、required 或 rules。
 *
 * @typeParam T - 表单值类型。
 */
export interface SchemxContainerDependencies<T extends Values = Values> {
  /**
   * 触发容器状态重新计算的字段路径。
   */
  triggerFields: NamePath<T>[]
  /**
   * 动态计算容器及后代是否只读。
   */
  readonly?: SchemxConditionFn<T, boolean>
  /**
   * 动态计算容器及后代是否禁用。
   */
  disabled?: SchemxConditionFn<T, boolean>
  /**
   * 动态计算容器及后代是否可见。
   */
  visible?: SchemxConditionFn<T, boolean>
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
 * @typeParam TName - 当前字段路径，用于推导字段专属的动态属性类型。
 *
 * @example
 * ```ts
 * // 等价于：
 * // {
 * //   componentProps: SchemxComponentProps<T, K>
 * //   placeholder: string
 * //   required: RequiredRule<string>
 * //   readonly: boolean
 * //   disabled: boolean
 * //   visible: boolean
 * // }
 * type Defaults = SchemxDependenciesStaticProps<MyForm>
 * ```
 */
export type SchemxDependenciesStaticProps<
  T extends Values = Values,
  TName extends NamePath<T> = NamePath<T>,
> = {
  [P in SchemxDependenciesConditionKey]-?: SchemxDependencies<T, TName>[P] extends
    SchemxConditionFn<T, infer R> | undefined
    ? R
    : never
}
