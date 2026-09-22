/**
 * 字段类型定义
 *
 * 定义普通字段及与字段渲染相关的共享类型。
 *
 * @module types/field
 */

// 有意保留声明合并能力，以支持 Schema 专属的扩展接口。
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { SchemxComponentProps } from "./componentProps"
import type { SchemxFieldDependencies } from "./dependencies"
import type { FieldValue, NamePath, ValidationTrigger, Values } from "./form"
import type { SchemxInstance } from "./instance"
import type { SchemxLayout } from "./layout"
import type { SchemxRendererDefinition, SchemxRendererKey } from "./renderer"
import type { DefinedFieldValue, FieldRules, RequiredConfig } from "./rule"

/**
 * 自定义 Schema 基础字段扩展接口
 *
 * 空接口占位，供业务方通过 TypeScript 声明合并（declaration merging）
 * 向 {@link SchemxBase} 注入额外的自定义字段。
 *
 * @example
 * ```ts
 * declare module '@schemx/core' {
 *   interface SchemxFieldDefinition {
 *     tooltip?: string
 *     span?: number
 *   }
 * }
 * ```
 *
 * 扩展属性会作为静态 Schema 元数据保留，并透传到 Field ViewSchema；
 * 声明扩展属性不会自动增加 dependencies 可动态覆盖的属性。
 *
 * @typeParam TValues - 当前表单值类型，供适配层回调属性使用。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxFieldDefinition<TValues extends Values = Values> {}

/** 读取字段适配层扩展属性；未声明扩展时保留 Core 的兼容默认类型。 */
type SchemxFieldDefinitionValue<
  TValues extends Values,
  TKey extends PropertyKey,
  TDefault,
> = TKey extends keyof SchemxFieldDefinition<TValues>
  ? SchemxFieldDefinition<TValues>[Extract<TKey, keyof SchemxFieldDefinition<TValues>>]
  : TDefault

/** 使用适配层声明的标签图标类型；Core-only 消费者继续得到旧字符串契约。 */
type SchemxFieldIconValue<TValues extends Values> = SchemxFieldDefinitionValue<
  TValues,
  "labelIcon",
  string
>

/**
 * 基础字段配置
 *
 * 描述单个表单字段的完整配置，包括组件类型、校验规则、动态属性等。
 *
 * @typeParam  TValues - 表单值类型
 * @typeParam  TKey - 组件类型键，用于收窄 componentProps 类型
 */
export interface SchemxBase<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxRendererKey<TValues>,
> extends SchemxFieldDefinition<TValues> {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string
  /**
   * 字段名称
   *
   * 支持嵌套路径语法，如 `'user.name'`、`['user', 'address', 'city']`。
   * 用于在表单内部状态中定位字段值。
   */
  name: TName

  /**
   * 字段标签文本
   *
   * 显示在表单项左侧的描述文字，不设置时不渲染 label 区域。
   */
  label: string

  /**
   * 渲染组件类型
   *
   * 对应 SchemxRendererDefinition 中注册的组件键名，
   * 用于从 rendererRegistry 中查找并渲染对应的表单控件。
   */
  componentType: TKey

  /**
   * 字段在旧版 24 栅格布局中的静态配置。
   *
   * @deprecated 请改用 {@link import("@schemx/vue").SchemxColConfig} 与 Schema 的 `col` 字段。
   */
  layout?: SchemxLayout

  /**
   * 结构化依赖配置对象
   *
   * 声明 {@link SchemxFieldDependencies.triggerFields | triggerFields} 和各属性的条件函数，
   * 当任一触发字段变化时执行已配置的条件函数，覆盖对应的静态默认值。
   */
  dependencies?: SchemxFieldDependencies<TValues, TName, TKey>

  /**
   * 传递给渲染组件的属性（静态默认值）
   *
   * 类型根据 `componentType` 自动收窄为对应组件的 Props 类型。
   */
  componentProps?: SchemxComponentProps<TValues, TKey>

  /**
   * 在当前 schema 被删除时保留字段值，默认值 true
   */
  preserve?: boolean

  /**
   * 占位提示文本（静态默认值）
   */
  placeholder?: string

  /**
   * 是否启用必填校验（静态默认值）
   *
   * 视觉标记由 `showRequiredMark` 独立控制；未显式设置时，标记默认跟随有效的
   * `required` 值。
   */
  required?: RequiredConfig<DefinedFieldValue<TValues, TName>>

  /**
   * 是否显示必填视觉标记。
   *
   * 该属性只控制渲染层的必填标记，不启用、禁用或改变 `required` 校验。
   * 未配置时，最终值跟随当前有效 `required`；静态或动态显式值优先。
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  showRequiredMark?: boolean

  /**
   * 是否只读（静态默认值）
   *
   * 未设置时继承当前 Form 的 `schemaConfig.readonly` 配置。
   */
  readonly?: boolean

  /**
   * 占位提示文本（静态默认值） - 只读状态
   */
  readonlyPlaceholder?: string

  /**
   * 是否禁用（静态默认值）
   *
   * 未设置时继承当前 Form 的 `schemaConfig.disabled` 配置。
   */
  disabled?: boolean

  /**
   * 是否可见（静态默认值）
   *
   * 不可见时字段不渲染，同时会清除校验规则和错误信息。
   */
  visible?: boolean

  /**
   * 字段初始值
   *
   * 组件挂载时写入表单状态，同时作为 `reset()` 的还原目标。
   */
  initialValue?: FieldValue<TValues, TName>

  /**
   * 校验规则
   *
   * 支持 Standard Schema 实例（如 Zod、Valibot 等实现了 Standard Schema 接口的验证库）、
   * 已注册的命名规则或原生校验规则。
   * 校验在 `submit` 或触发时机（`validationTrigger`）到达时执行。
   * 必填校验请使用 `required` 配置。
   *
   * @example
   * ```ts
   * rules: ["email", emailSchema]
   * ```
   */
  rules?: FieldRules<TValues, TName>

  /**
   * 标签图标标识。
   *
   * @deprecated 标签图标由适配层定义；请通过 {@link SchemxFieldDefinition} 提供适配层支持的类型，兼容期间仍保留。
   */
  labelIcon?: SchemxFieldIconValue<TValues>

  /**
   * 标签对齐方式
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelAlign` 配置。
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  labelAlign?: "left" | "center" | "right"

  /**
   * 标签位置
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelPosition` 配置。
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  labelPosition?: "left" | "top" | "right"

  /**
   * 标签宽度
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelWidth` 配置。
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  labelWidth?: string | number

  /**
   * 内容区域对齐方式
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  contentAlign?: "left" | "center" | "right"

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承当前 Form 的 `schemaConfig.colon` 配置。
   *
   * @deprecated 展示配置由 UI 适配层提供；请改用 {@link SchemxFieldDefinition} 扩展点，兼容期间仍保留。
   */
  colon?: boolean

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承当前 Form 的 `schemaConfig.validationTrigger` 配置。
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 值变化触发
   */
  onChange?: (value: FieldValue<TValues, TName>, form: SchemxInstance<TValues>) => void

  /**
   * 失焦触发
   */
  onBlur?: (form: SchemxInstance<TValues>) => void

  /**
   * 容器结构保留字段。
   *
   * 普通字段不能在顶层声明这些属性；Renderer 配置应放入 `componentProps`。
   */
  children?: never
  /**
   * 普通字段不使用结构化依赖目标字段。
   */
  to?: never
  /**
   * 普通字段不使用动态 Schema renderer。
   */
  renderer?: never
}

/**
 * 基础字段配置的精确分布式联合类型。
 */
type SchemxBaseFieldByName<TValues extends Values, TName extends NamePath<TValues>> = [
  Extract<keyof SchemxRendererDefinition<TValues>, string>,
] extends [never]
  ? SchemxBase<TValues, TName, string>
  : {
      [TKey in Extract<keyof SchemxRendererDefinition<TValues>, string>]: SchemxBase<
        TValues,
        TName,
        TKey
      >
    }[Extract<keyof SchemxRendererDefinition<TValues>, string>]

/**
 * 精确基础字段类型。
 *
 * 同时关联字段名、字段值与 Renderer Props，适用于单字段配置和类型校验。
 */
export type SchemxExactBaseField<TValues extends Values = Values> = {
  [TName in NamePath<TValues>]: SchemxBaseFieldByName<TValues, TName>
}[NamePath<TValues>]

/**
 * Core 运行时使用的基础字段类型。
 *
 * 不建立 Renderer 判别联合，便于运行时合并和更新字段属性。
 */
export type SchemxBaseField<TValues extends Values = Values> = SchemxBase<
  TValues,
  NamePath<TValues>,
  SchemxRendererKey<TValues>
>
