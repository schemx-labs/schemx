/**
 * schema 列配置类型
 *
 * 定义表单字段的 Schema 配置结构，包括基础字段、嵌套字段、
 * 分组字段、依赖字段，以及规范化后的配置类型。
 *
 * @module types/schema
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { SchemxDependencies } from "./dependencies"
import type {
  FieldValue,
  NamePath,
  SchemxFormApi,
  SchemxInstance,
  ValidationTrigger,
  Values,
} from "./form"
import type { SchemxRendererDefinition } from "./renderer"
import type { SchemxRules } from "./rule"

type SchemxComponentTypeKey<TValues extends Values> = [
  Extract<keyof SchemxRendererDefinition<TValues>, string>,
] extends [never]
  ? string
  : Extract<keyof SchemxRendererDefinition<TValues>, string>

/**
 * dependency schema renderer 执行上下文。
 *
 * signal 会在同一 dependency 节点的新一轮 renderer 开始或节点销毁时 abort，
 * 便于调用方取消远程请求等异步工作。
 */
export interface SchemxDependencyRendererContext {
  /**
   * 中止信号，用于取消渲染器执行。
   */
  abortSignal: AbortSignal
}

/**
 * 渲染器组件通用扩展属性
 *
 * 所有渲染器组件都会自动注入的公共 props，
 * 与 {@link SchemxRendererDefinition} 中各组件的专属 Props 交叉后，
 * 作为 `componentProps` 的最终类型。
 */
export interface SchemxBaseComponentProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
> {
  /**
   * 是否只读
   */
  readonly?: boolean
  /**
   * 是否禁用
   */
  disabled?: boolean
  /**
   * 占位符
   */
  placeholder?: string
  /**
   * 只读并且值为空时的占位符
   */
  readonlyPlaceholder?: string
  /**
   * 内容区域对齐方式
   */
  align?: "left" | "center" | "right"
  /**
   * FormItem 组件 Props
   */
  formItemProps?: SchemxFormItemProps<TValues>
  /**
   * 字段值
   */
  value?: TValue
  /**
   * 值变化处理
   */
  "onUpdate:value"?: (value: TValue) => void
  /**
   * 值变化处理
   */
  onChange?: (value: TValue) => void
  /**
   * 失焦处理
   */
  onBlur?: (value: TValue) => void
}

/**
 * 渲染器组件完整 Props 类型
 *
 * 将 {@link SchemxRendererDefinition} 中对应组件的专属 Props 与 {@link SchemxBaseComponentProps} 交叉，
 * 得到传递给渲染组件的完整属性类型。
 *
 * @typeParam  TKey - 组件类型键
 */
export type SchemxComponentProps<
  TValues extends Values = Values,
  TKey extends string = SchemxComponentTypeKey<TValues>,
> = [Extract<keyof SchemxRendererDefinition<TValues>, string>] extends [never]
  ? SchemxBaseComponentProps<TValues>
  : TKey extends keyof SchemxRendererDefinition<TValues>
    ? SchemxRendererDefinition<TValues>[TKey] & SchemxBaseComponentProps<TValues>
    : SchemxBaseComponentProps<TValues>

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
 */
export interface SchemxFieldDefinition {}

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
  TKey extends string = SchemxComponentTypeKey<TValues>,
> extends SchemxFieldDefinition {
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
  name: NamePath<TValues>

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
   * 结构化依赖配置对象
   *
   * 声明 {@link SchemxDependencies.triggerFields | triggerFields} 和各属性的条件函数，
   * 当任一触发字段变化时执行已配置的条件函数，覆盖对应的静态默认值。
   */
  dependencies?: SchemxDependencies<TValues>

  /**
   * 传递给渲染组件的属性（静态默认值）
   *
   * 类型根据 `componentType` 自动收窄为对应组件的 Props 类型。
   */
  componentProps?: SchemxComponentProps<TValues, TKey>

  /**
   * 占位提示文本（静态默认值）
   */
  placeholder?: string

  /**
   * 是否展示必填的 * 号（静态默认值）
   *
   * 控制必填标记（红色星号）的显示。
   * 若未设置，会根据 `rules` 中的校验规则自动推断。
   */
  required?: boolean

  /**
   * 是否只读（静态默认值）
   *
   * 未设置时继承 FormContext 的全局 `readonly` 配置。
   */
  readonly?: boolean

  /**
   * 是否禁用（静态默认值）
   *
   * 未设置时继承 FormContext 的全局 `disabled` 配置。
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
  initialValue?: FieldValue<TValues, NamePath<TValues>>

  /**
   * 校验规则
   *
   * 支持 StandardSchemaV1 实例（如 Zod、Valibot 等实现了 Standard Schema 接口的验证库）
   * 或内置快捷方式（如 `"required"`）。
   * 校验在 `submit` 或触发时机（`validationTrigger`）到达时执行。
   */
  rules?: SchemxRules | SchemxRules[]

  /**
   * 标签图标
   *
   * 显示在 label 文本旁的图标标识。
   */
  labelIcon?: string

  /**
   * 标签对齐方式
   *
   * 未设置时继承 FormContext 的全局 `labelAlign` 配置。
   */
  labelAlign?: "left" | "center" | "right"

  /**
   * 标签位置
   *
   * 未设置时继承 FormContext 的全局 `labelPosition` 配置。
   */
  labelPosition?: "left" | "top" | "right"

  /**
   * 标签宽度
   *
   * 未设置时继承 FormContext 的全局 `labelWidth` 配置。
   */
  labelWidth?: string

  /**
   * 内容区域对齐方式
   */
  contentAlign?: "left" | "center" | "right"

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承 FormContext 的全局 `colon` 配置。
   */
  colon?: boolean

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承 FormContext 的全局 `validationTrigger` 配置。
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 值变化触发
   */
  onChange?: (value: FieldValue<TValues>, form: SchemxInstance<TValues>) => void

  /**
   * 失焦触发
   */
  onBlur?: (form: SchemxInstance<TValues>) => void
}

/**
 * FormItem 组件 Props
 */
export type SchemxFormItemProps<TValues extends Values = Values> = Omit<
  SchemxBase<TValues>,
  "componentProps"
>

/**
 * 基础字段配置的分布式联合类型
 *
 * 将每个 componentType 展开为独立的 SchemxBaseField 变体，
 * 使 schemas 数组中每个元素根据 componentType 获得精确的 componentProps 类型推断。
 *
 * 当 SchemxRendererDefinition 未注册任何渲染器时，回退为宽松的 SchemxBase 类型，
 * 避免因 keyof 为 never 导致整个类型坍塌。
 *
 * @typeParam  TValues - 表单值类型
 */
export type SchemxBaseField<TValues extends Values = Values> = [
  Extract<keyof SchemxRendererDefinition<TValues>, string>,
] extends [never]
  ? SchemxBase<TValues, string>
  : {
      [TKey in Extract<keyof SchemxRendererDefinition<TValues>, string>]: SchemxBase<
        TValues,
        TKey
      >
    }[Extract<keyof SchemxRendererDefinition<TValues>, string>]

/**
 * 自定义 Group Schema 基础字段扩展接口
 *
 * 空接口占位，供业务方通过 TypeScript 声明合并（declaration merging）
 * 向 {@link SchemxBase} 注入额外的自定义字段。
 *
 * @example
 * ```ts
 * declare module '@schemx/core' {
 *   interface SchemxGroupFieldDefinition {
 *     tooltip?: string
 *     span?: number
 *   }
 * }
 * ```
 */
export interface SchemxGroupFieldDefinition {}

/**
 * 分组字段配置
 *
 * 将多个字段组织为可折叠的分组，componentType 固定为 `"group"`。
 *
 * @typeParam  TValues - 表单值类型
 */
export interface SchemxGroupField<
  TValues extends Values = Values,
> extends SchemxGroupFieldDefinition {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string
  /**
   * 分组标签
   */
  label: string
  /**
   * 组件类型（固定为 group）
   */
  componentType: "group"
  /**
   * 分组内的列配置
   */
  children: SchemxField<TValues>[]
  /**
   * 是否可折叠
   */
  collapsible?: boolean
  /**
   * 默认是否折叠
   */
  defaultCollapsed?: boolean
}

/**
 * 动态子树依赖字段配置
 *
 * 根据其他字段的值动态生成一段子 schema，componentType 固定为 `"dependency"`。
 * 该配置会被编译为 DependencyEffectSlot。
 *
 * @typeParam  TValues - 表单值类型
 */
export interface SchemxDependencyField<
  TValues extends Values = Values,
  TNames extends readonly NamePath<TValues>[] = readonly NamePath<TValues>[],
> {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string
  /**
   * 组件类型（固定为 dependency）
   */
  componentType: "dependency"
  /**
   * 依赖的字段路径
   */
  to: TNames
  /**
   * 动态列配置生成函数
   */
  renderer: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: SchemxDependencyRendererContext
  ) => SchemxField<TValues>[] | Promise<SchemxField<TValues>[]>
}

/**
 * 字段配置联合类型
 *
 * 表单 schemas 数组中每个元素的类型。
 *
 * @typeParam  TValues - 表单值类型
 */
export type SchemxField<TValues extends Values = Values> =
  | SchemxBaseField<TValues>
  | SchemxGroupField<TValues>
  | SchemxDependencyField<TValues>

/**
 * 编译后的字段静态 schema。
 *
 * 校验和动态依赖由 FieldDescriptor 顶层字段承载，避免静态默认值、
 * 校验规则和运行时动态派生规则混在同一个对象里。
 */
export type SchemxResolvedBaseField<TValues extends Values = Values> = Omit<
  SchemxBaseField<TValues>,
  "dependencies"
>

/**
 * 编译后的分组静态 schema。
 */
export type SchemxResolvedGroupField<TValues extends Values = Values> = Omit<
  SchemxGroupField<TValues>,
  "children"
> & {
  children: SchemxResolvedField<TValues>[]
}

/**
 * 解析后的静态 schema 类型。
 */
export type SchemxResolvedField<TValues extends Values = Values> =
  | SchemxResolvedBaseField<TValues>
  | SchemxResolvedGroupField<TValues>
