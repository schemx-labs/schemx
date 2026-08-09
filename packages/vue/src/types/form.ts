import type { StyleValue } from "vue"

import type {
  DefinedFieldValue,
  FormCallbackOptions,
  FormLifecycleOptions,
  NamePath,
  RequiredRule,
  SchemxConfig,
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
  required?: RequiredRule<DefinedFieldValue<TValues, NamePath<TValues>>>
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
 * schemx 组件 Props
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormProps<TValues extends Values = Values>
  extends
    Omit<SchemxConfig, "schemaConfig">,
    FormCallbackOptions<TValues>,
    FormLifecycleOptions<TValues>,
    SchemxFormSchemaConfigProps<TValues> {
  /**
   * 初始 Schema 列表。
   */
  schemas?: SchemxSchemasInput<TValues>

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
   * 自定义 CSS 类名
   */
  class?: string

  /**
   * 自定义内联样式
   */
  style?: StyleValue
}
