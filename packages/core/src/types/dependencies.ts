/**
 * 依赖对象类型定义
 *
 * 定义结构化的依赖配置接口，所有动态属性共享同一组 triggerFields，
 * 当任一触发字段变化时执行已配置的条件函数。
 *
 * @module types/dependencies
 */

import type { NamePath, SchemxFormApi, Values } from "./form"
import type { SchemxRendererKey } from "./renderer"
import type { DefinedFieldValue, FieldRules, RequiredRule } from "./rule"
import type { SchemxBase } from "./schema"

/**
 * 条件函数类型
 *
 * 接收当前表单值，返回属性的计算结果（支持同步和异步）。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam R - 返回值类型
 * @param values - 条件执行时的当前表单值快照。
 * @param form - 可读取或更新当前表单的公开 API。
 * @returns 属性计算结果或异步结果。
 */
export type SchemxConditionFn<TValues extends Values = Values, R = unknown> = (
  values: TValues,
  form: SchemxFormApi<TValues>
) => R | Promise<R>

/**
 * 三类 Schema 共用的结构化依赖配置。
 *
 * Field、Group 和 Dependency 都通过该配置共享触发字段与动态状态。
 * 具体 Schema 类型会重新声明状态属性，以提供准确的静态默认值文档。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxContainerDependencies<TValues extends Values = Values> {
  /**
   * 触发所有条件函数重新执行的字段路径数组
   *
   * 当数组中任一字段的值发生变化时，所有已配置的条件函数将被重新执行。
   * 支持嵌套路径语法，如 `'user.address.city'`。
   */
  triggerFields: NamePath<TValues>[]

  /**
   * 是否只读
   *
   * 条件函数返回 `boolean` 类型，只读状态下字段可见但不可编辑。
   * 未配置时使用宿主 Schema 的静态默认值。
   */
  readonly?: SchemxConditionFn<TValues, boolean>
  /**
   * 是否禁用
   *
   * 条件函数返回 `boolean` 类型，禁用状态下字段不可交互。
   * 未配置时使用宿主 Schema 的静态默认值。
   */
  disabled?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否可见
   *
   * 条件函数返回 `boolean` 类型，不可见时字段不渲染，
   * 同时会清除校验规则和错误信息。
   * 未配置时使用宿主 Schema 的静态默认值。
   */
  visible?: SchemxConditionFn<TValues, boolean>

  /**
   * 副作用触发器
   *
   * 条件函数返回 `void` 类型，仅用于执行副作用逻辑（如联动清空、远程请求）。
   * 与其他条件函数并行执行，异常独立捕获不影响属性解析。
   */
  trigger?: SchemxConditionFn<TValues, void>
}

/**
 * 字段节点的结构化依赖配置。
 *
 * 所有条件函数共享同一个 `triggerFields`，当任一触发字段变化时，
 * 执行所有已配置的条件函数并更新对应属性值。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径，用于推导必填判断与校验规则的字段值类型。
 * @typeParam TKey - 当前 Renderer 类型，用于收窄动态 `componentProps`。
 *
 * @example
 * ```ts
 * const deps: SchemxFieldDependencies<MyForm, "city"> = {
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
export interface SchemxFieldDependencies<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxRendererKey<TValues>,
> extends SchemxContainerDependencies<TValues> {
  /**
   * 副作用触发器。
   *
   * 当任一 {@link SchemxFieldDependencies.triggerFields | triggerFields} 的值变化时执行。
   * 仅用于联动清空、远程请求等副作用，不会覆盖字段的静态属性。
   */
  trigger?: SchemxConditionFn<TValues, void>

  /**
   * 是否只读
   *
   * 条件函数返回 `boolean` 类型，只读状态下字段可见但不可编辑。
   * 未配置时使用 {@link SchemxBase.readonly} 的静态默认值。
   */
  readonly?: SchemxConditionFn<TValues, boolean>
  /**
   * 是否禁用
   *
   * 条件函数返回 `boolean` 类型，禁用状态下字段不可交互。
   * 未配置时使用 {@link SchemxBase.disabled} 的静态默认值。
   */
  disabled?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否可见
   *
   * 条件函数返回 `boolean` 类型，不可见时字段不渲染，
   * 同时会清除校验规则和错误信息。
   * 未配置时使用 {@link SchemxBase.visible} 的静态默认值。
   */
  visible?: SchemxConditionFn<TValues, boolean>

  /**
   * 传递给渲染组件的属性
   *
   * 条件函数返回 {@link SchemxComponentProps} 类型，
   * 根据 `componentType` 自动收窄为对应组件的 Props 类型。
   * 未配置时使用 {@link SchemxBase.componentProps} 的静态默认值。
   */
  componentProps?: SchemxConditionFn<
    TValues,
    NonNullable<SchemxBase<TValues, TName, TKey>["componentProps"]>
  >

  /**
   * 占位提示文本
   *
   * 条件函数返回 `string` 类型，用于动态计算输入框的占位文本。
   * 未配置时使用 {@link SchemxBase.placeholder} 的静态默认值。
   */
  placeholder?: SchemxConditionFn<
    TValues,
    NonNullable<SchemxBase<TValues, TName>["placeholder"]>
  >

  /**
   * 是否必填
   *
   * 条件函数返回字段对应的 {@link RequiredRule}，控制必填校验；必填视觉标记由
   * `showRequiredMark` 独立控制。对象形式的 `isEmpty` 参数按当前字段路径推导。
   * 未配置时使用 {@link SchemxBase.required} 的静态默认值。
   */
  required?: SchemxConditionFn<TValues, RequiredRule<DefinedFieldValue<TValues, TName>>>

  /**
   * 是否显示必填视觉标记。
   *
   * 条件函数返回 `boolean`，只覆盖渲染层的必填标记，不改变动态或静态
   * `required` 校验。未配置静态标记时，标记默认跟随当前有效 `required`。
   */
  showRequiredMark?: SchemxConditionFn<TValues, boolean>

  /**
   * 占位提示文本 - 只读状态
   *
   * 条件函数返回 `string` 类型，用于动态计算输入框的占位文本。
   * 未配置时使用 {@link SchemxBase.readonlyPlaceholder} 的静态默认值。
   */
  readonlyPlaceholder?: SchemxConditionFn<
    TValues,
    NonNullable<SchemxBase<TValues, TName>["readonlyPlaceholder"]>
  >

  /**
   * 校验规则
   *
   * 条件函数返回字段 `rules` 类型，用于动态计算字段的校验规则。
   * 未配置时使用 {@link SchemxBase.rules} 的静态默认值。
   */
  rules?: SchemxConditionFn<TValues, FieldRules<TValues, TName> | undefined>
}

/**
 * Group 容器的结构化依赖配置。
 *
 * 用于动态控制整棵 Group 子树的呈现状态；后续 Group 专属动态属性也应在此扩展。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxGroupDependencies<
  TValues extends Values = Values,
> extends SchemxContainerDependencies<TValues> {
  /**
   * 副作用触发器。
   *
   * 当任一 {@link SchemxGroupDependencies.triggerFields | triggerFields} 的值变化时执行。
   * 仅用于协调 Group 子树相关的副作用，不会覆盖容器的静态属性。
   */
  trigger?: SchemxConditionFn<TValues, void>

  /**
   * 是否只读。
   *
   * 条件函数返回 `boolean` 类型，只读状态下 Group 的后代字段不可编辑。
   * 未配置时使用 {@link SchemxGroupField.readonly} 的静态默认值。
   */
  readonly?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否禁用。
   *
   * 条件函数返回 `boolean` 类型，禁用状态下 Group 的后代字段不可交互。
   * 未配置时使用 {@link SchemxGroupField.disabled} 的静态默认值。
   */
  disabled?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否可见。
   *
   * 条件函数返回 `boolean` 类型；不可见时整棵 Group 子树不渲染。
   * 未配置时使用 {@link SchemxGroupField.visible} 的静态默认值。
   */
  visible?: SchemxConditionFn<TValues, boolean>
}

/**
 * Dependency 容器的结构化依赖配置。
 *
 * 用于动态控制由 renderer 生成的子树呈现状态；后续 Dependency 专属动态属性
 * 应在此扩展。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxDependencyDependencies<
  TValues extends Values = Values,
> extends SchemxContainerDependencies<TValues> {
  /**
   * 副作用触发器。
   *
   * 当任一 {@link SchemxDependencyDependencies.triggerFields | triggerFields} 的值变化时执行。
   * 仅用于协调动态子树相关的副作用，不会覆盖容器的静态属性。
   */
  trigger?: SchemxConditionFn<TValues, void>

  /**
   * 是否只读。
   *
   * 条件函数返回 `boolean` 类型，只读状态下动态子树的字段不可编辑。
   * 未配置时使用 {@link SchemxDependencyField.readonly} 的静态默认值。
   */
  readonly?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否禁用。
   *
   * 条件函数返回 `boolean` 类型，禁用状态下动态子树的字段不可交互。
   * 未配置时使用 {@link SchemxDependencyField.disabled} 的静态默认值。
   */
  disabled?: SchemxConditionFn<TValues, boolean>

  /**
   * 是否可见。
   *
   * 条件函数返回 `boolean` 类型；不可见时动态子树不渲染。
   * 未配置时使用 {@link SchemxDependencyField.visible} 的静态默认值。
   */
  visible?: SchemxConditionFn<TValues, boolean>
}

/**
 * 字段依赖配置的旧名称。
 *
 * @deprecated 请使用 {@link SchemxFieldDependencies}，以明确该配置只适用于普通字段。
 */
export type SchemxDependencies<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxRendererKey<TValues>,
> = SchemxFieldDependencies<TValues, TName, TKey>

/**
 * 可解析的属性键（不含 triggerFields 和 trigger）
 *
 * 用于约束 defaults 对象的键值范围。
 */
export type SchemxFieldDependenciesConditionKey = Exclude<
  keyof SchemxFieldDependencies,
  "triggerFields" | "trigger"
>

/**
 * 字段依赖可解析属性键的旧名称。
 *
 * @deprecated 请使用 {@link SchemxFieldDependenciesConditionKey}。
 */
export type SchemxDependenciesConditionKey = SchemxFieldDependenciesConditionKey

/**
 * 从 SchemxFieldDependencies 中提取各属性的静态返回类型
 *
 * 排除 `triggerFields`（配置字段）和 `trigger`（void 无静态值意义），
 * 将每个 `SchemxConditionFn<TValues, R>` 映射为 `R`。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径，用于推导字段专属的动态属性类型。
 * @typeParam TKey - 当前 Renderer 类型，用于收窄动态 `componentProps`。
 *
 * @example
 * ```ts
 * // 等价于：
 * // {
 * //   componentProps: SchemxComponentProps<TValues, K>
 * //   placeholder: string
 * //   required: RequiredRule<string>
 * //   readonly: boolean
 * //   disabled: boolean
 * //   visible: boolean
 * // }
 * type Defaults = SchemxDependenciesStaticProps<MyForm>
 * ```
 */
export type SchemxFieldDependenciesStaticProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxRendererKey<TValues>,
> = {
  [P in SchemxFieldDependenciesConditionKey]-?: SchemxFieldDependencies<
    TValues,
    TName,
    TKey
  >[P] extends SchemxConditionFn<TValues, infer R> | undefined
    ? R
    : never
}

/**
 * 字段依赖静态属性类型的旧名称。
 *
 * @deprecated 请使用 {@link SchemxFieldDependenciesStaticProps}。
 */
export type SchemxDependenciesStaticProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxRendererKey<TValues>,
> = SchemxFieldDependenciesStaticProps<TValues, TName, TKey>
