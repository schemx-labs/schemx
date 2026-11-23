/**
 * 评分渲染器类型定义
 *
 * @module renderers/RateRenderer/types
 */

import type { RateProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type RateValue = RateProps["modelValue"]

/**
 * 评分渲染器 Props
 *
 * 定义评分组件的所有可配置属性。
 */
export interface RateRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<RateProps, "modelValue" | "onUpdate:modelValue" | "onChange">> {
  /** 当前评分值 */
  value?: RateValue
  /** 值变化回调 */
  onChange?: (value: RateValue) => void
  /** 星星总数 */
  count?: RateProps["count"]
  /** 是否允许半星 */
  allowHalf?: RateProps["allowHalf"]
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: RateProps["readonly"]
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: RateProps["disabled"]
}
