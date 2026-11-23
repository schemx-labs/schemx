/**
 * 开关渲染器类型定义
 *
 * @module renderers/SwitchRenderer/types
 */

import type { SwitchProps } from "@wot-ui/ui/components/wd-switch/types"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type SwitchValue = boolean | string | number

/**
 * 开关渲染器 Props
 *
 * 定义开关组件的所有可配置属性。
 */
export interface SwitchRendererProps
  extends
    /* @vue-ignore */ Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<
        SwitchProps,
        | "modelValue"
        | "onUpdate:modelValue"
        | "onChange"
        | "activeValue"
        | "inactiveValue"
        | "loading"
        | "disabled"
      >
    > {
  /** 当前值 */
  value?: SwitchValue
  /** 值变化回调，支持异步返回值以更新表单字段 */
  onChange?: (value: SwitchValue) => void | Promise<SwitchValue | void>
  /** 自定义 CSS 类名 */
  className?: string
  /** 激活状态的文本 */
  activeText?: string
  /** 激活状态对应的值 */
  activeValue?: SwitchValue
  /** 非激活状态对应的值 */
  inactiveValue?: SwitchValue
  /** 非激活状态的文本 */
  inactiveText?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
}
