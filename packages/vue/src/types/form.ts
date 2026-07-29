import { StyleValue } from "vue"

import type {
  FormCallbackOptions,
  FormLifecycleOptions,
  FormRegistryOptions,
  FormSchemaOptions,
  SchemxSchemaConfig,
} from "@schemx/core"

import type { SchemxInstance, ValidationTrigger, Values } from "@schemx/core"

/**
 * schemx 组件 Props
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormProps<TValues extends Values = Values>
  extends
    Omit<FormSchemaOptions<TValues>, "schemaConfig">,
    FormRegistryOptions,
    FormCallbackOptions<TValues>,
    FormLifecycleOptions<TValues>,
    SchemxSchemaConfig {
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
