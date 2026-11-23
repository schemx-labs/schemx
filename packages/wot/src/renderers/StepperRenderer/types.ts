/**
 * 步进器渲染器类型定义
 *
 * @module renderers/StepperRenderer/types
 */

import type { InputNumberProps } from "@wot-ui/ui/components/wd-input-number/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type StepperValue = InputNumberProps["modelValue"]

/**
 * 步进器渲染器 Props
 *
 * 定义步进器组件的所有可配置属性。
 */
export interface StepperRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputNumberProps, "modelValue" | "onUpdate:modelValue" | "onChange">> {
  /** 当前值 */
  value?: StepperValue
  /** 值变化回调 */
  onChange?: (value: StepperValue) => void
  /** 最小值 */
  min?: InputNumberProps["min"]
  /** 最大值 */
  max?: InputNumberProps["max"]
  /** 步长 */
  step?: InputNumberProps["step"]
  /** 是否只允许整数 */
  integer?: boolean
  /** 小数位数 */
  decimalLength?: InputNumberProps["precision"]
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: InputNumberProps["disabled"]
  /** 是否允许空值 */
  allowEmpty?: InputNumberProps["allowNull"]
}
