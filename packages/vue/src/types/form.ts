import type { ClassValue, StyleValue } from "vue"

import type { SchemxVueConfig } from "./layout"
import type { SchemxButtonProps } from "../components/Button"
import type {
  DefinedFieldValue,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  NamePath,
  RequiredConfig,
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
  required?: RequiredConfig<DefinedFieldValue<TValues, NamePath<TValues>>>
  readonly?: boolean
  disabled?: boolean
  visible?: boolean
  labelIcon?: string
  labelAlign?: "left" | "center" | "right"
  labelPosition?: "left" | "top" | "right"
  labelWidth?: string
  contentAlign?: "left" | "center" | "right"
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  colon?: boolean
  showRequiredMark?: boolean
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
 */
export type SchemxFormAction = boolean | SchemxFormActionConfig

/**
 * schemx 组件 Props
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormProps<TValues extends Values = Values>
  extends
    Omit<SchemxVueConfig<TValues>, "schemaConfig">,
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
