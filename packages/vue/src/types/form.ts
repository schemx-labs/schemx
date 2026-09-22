/**
 * Vue 表单组件与表单操作的公开类型。
 *
 * @module types/form
 */

import type { ClassValue, StyleValue } from "vue"

import type { SchemxIconComponent, SchemxIconValue } from "./icon"
import type {
  SchemxColComponent,
  SchemxColConfig,
  SchemxLayout,
  SchemxRowComponent,
  SchemxRowConfig,
} from "./layout"
import type { SchemxButtonProps } from "../components/Button"
import type {
  DefinedFieldValue,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  NamePath,
  RequiredConfig,
  SchemxConfig,
  SchemxFieldRulesMap,
  SchemxInstance,
  SchemxSchemasInput,
  ValidationTrigger,
  Values,
} from "@schemx/core"

/**
 * Vue 需要在编译 `defineProps` 时直接读取 Props 的字段列表。
 *
 * Core 中的 `SchemxSchemaConfig` 是基于 `SchemxBaseField` 的外部复合类型别名，
 * Vue SFC 编译器无法将它作为接口基类展开。这里在框架适配层保留同一组字段，
 * 让运行时 Props 推导可静态解析，同时避免把这些配置误判为 fallthrough attrs。
 */
interface SchemxFormSchemaConfigProps<TValues extends Values = Values> {
  /**
   * 表单级必填校验配置；字段未覆盖时作为字段默认值。
   */
  required?: RequiredConfig<DefinedFieldValue<TValues, NamePath<TValues>>>

  /**
   * 是否将字段渲染为只读状态。
   */
  readonly?: boolean

  /**
   * 是否禁用字段交互。
   */
  disabled?: boolean

  /**
   * 是否渲染字段。
   */
  visible?: boolean

  /**
   * 当前 Form 使用的 Col 实现；单独声明以便 Vue SFC 编译器生成运行时 Props。
   */
  readonly colComponent?: SchemxColComponent

  /**
   * 当前 Form 使用的 Row 实现；单独声明以便 Vue SFC 编译器生成运行时 Props。
   */
  readonly rowComponent?: SchemxRowComponent

  /**
   * 当前 Form 使用的 Icon Adapter；单独声明以便 Vue SFC 编译器生成运行时 Props。
   */
  readonly iconComponent?: SchemxIconComponent

  /**
   * 字段默认 Col 配置。
   */
  col?: SchemxColConfig

  /**
   * 字段在 24 栅格布局容器中的旧静态布局配置。
   *
   * @deprecated 请改用 {@link SchemxColConfig} 与 `col` 字段。
   */
  layout?: SchemxLayout

  /**
   * 字段标签图标名称或 Vue 图标组件。
   */
  labelIcon?: SchemxIconValue

  /**
   * 字段标签的水平对齐方式。
   */
  labelAlign?: "left" | "center" | "right"

  /**
   * 字段标签位于控件左侧、顶部或右侧。
   */
  labelPosition?: "left" | "top" | "right"

  /**
   * 字段标签宽度。
   */
  labelWidth?: string | number

  /**
   * 字段内容区域的水平对齐方式。
   */
  contentAlign?: "left" | "center" | "right"

  /**
   * 字段校验错误的水平对齐方式。
   */
  errorAlign?: "left" | "center" | "right"

  /**
   * 字段校验触发时机。
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 是否在字段标签后显示冒号。
   */
  colon?: boolean

  /**
   * 是否显示必填视觉标记；不改变实际校验规则。
   */
  showRequiredMark?: boolean

  /**
   * 是否在字段底部显示边框。
   */
  bordered?: boolean
}

/**
 * 内置表单操作按钮的显示配置。
 *
 * `buttonProps` 会透传到内置 Button；`type` 和 `onClick` 由表单组件管理，不能覆盖。
 */
export interface SchemxFormActionConfig {
  /**
   * 按钮展示文本；未提供时使用操作的默认文案。
   */
  text?: string
  /**
   * 透传给内置 Button 的属性。
   */
  buttonProps?: Omit<SchemxButtonProps, "type" | "onClick">
}

/**
 * 内置表单操作按钮的启用配置。
 *
 * `true` 使用默认按钮配置，`false` 隐藏按钮，对象形式用于覆盖按钮文案和属性。
 */
export type SchemxFormAction = boolean | SchemxFormActionConfig

/**
 * schemx 表单组件 Props。
 *
 * `schemaConfig` 的字段以扁平 Props 形式暴露；Core 的回调、生命周期、性能和
 * Renderer 配置则通过继承的类型继续提供。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormProps<TValues extends Values = Values>
  extends
    Omit<SchemxConfig<TValues>, "schemaConfig">,
    FormCallbackOptions<TValues>,
    FormLifecycleOptions<TValues>,
    FormPerformanceOptions,
    SchemxFormSchemaConfigProps<TValues> {
  /**
   * 初始 Schema 列表。
   */
  schemas?: SchemxSchemasInput<TValues>

  /**
   * 按字段路径配置的字段规则兜底。
   */
  fieldRules?: SchemxFieldRulesMap<TValues>

  /**
   * Store 使用的初始表单值。
   */
  initialValues?: TValues

  /**
   * Vue 受控模式下的表单值。
   */
  modelValue?: TValues

  /**
   * 外部传入的表单实例；传入后由组件复用该实例。
   */
  form?: SchemxInstance<TValues>

  /**
   * 当前 Form 根级 Row 的配置。
   */
  row?: SchemxRowConfig

  /**
   * 覆盖内置操作区展示的提交状态；不改变 Core 的真实提交状态。
   */
  loading?: boolean

  /**
   * 提交按钮配置；默认显示，设为 false 时隐藏。
   */
  submitter?: SchemxFormAction

  /**
   * 重置按钮配置；默认显示，设为 false 时隐藏。
   */
  resetter?: SchemxFormAction

  /**
   * 自定义 CSS 类名
   */
  class?: ClassValue

  /**
   * 自定义内联样式
   */
  style?: StyleValue
}
