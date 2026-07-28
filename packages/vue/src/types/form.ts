import { StyleValue } from "vue"

import type {
  FormCallbackOptions,
  FormLifecycleOptions,
  FormRegistryOptions,
  FormSchemaOptions,
} from "@schemx/core"

import type { SchemxInstance, ValidationTrigger, Values } from "@schemx/core"

/**
 * schemx 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxFormProps<T extends Values = Values>
  extends
    Omit<FormSchemaOptions<T>, "schemaConfig">,
    FormRegistryOptions,
    FormCallbackOptions<T>,
    FormLifecycleOptions<T> {
  /**
   * 字段未显式设置时是否启用默认必填校验。
   */
  required?: boolean

  /**
   * 是否只读。
   */
  readonly?: boolean

  /**
   * 是否禁用。
   */
  disabled?: boolean

  /**
   * 是否显示字段。
   */
  visible?: boolean

  /**
   * 标签图标。
   */
  labelIcon?: string

  /**
   * 标签对齐方式。
   */
  labelAlign?: "left" | "center" | "right"

  /**
   * 标签位置。
   */
  labelPosition?: "left" | "top" | "right"

  /**
   * 标签宽度。
   */
  labelWidth?: string

  /**
   * 内容区域对齐方式。
   */
  contentAlign?: "left" | "center" | "right"

  /**
   * 校验触发时机。
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 是否在标签后显示冒号。
   */
  colon?: boolean

  /**
   * 是否显示必填视觉标记。
   */
  showRequiredMark?: boolean

  /**
   * Vue 受控模式下的表单值。
   */
  modelValue?: T

  /**
   * 外部传入的表单实例；传入后由组件复用该实例。
   */
  form?: SchemxInstance<T>

  /**
   * 自定义 CSS 类名
   */
  class?: string

  /**
   * 自定义内联样式
   */
  style?: StyleValue
}
