/** InputOtp Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { InputOtpProps } from "element-plus"

/** 一次性密码字段值。 */
export type InputOtpValue = string

/** Element Plus 一次性密码 Renderer Props。 */
export interface InputOtpRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<InputOtpProps, "modelValue" | "disabled">> {
  /** 当前一次性密码；数字只用于兼容初始化值。 */
  value?: InputOtpValue | number
  /** 一次性密码变化回调。 */
  onChange?: (value: InputOtpValue) => void
  /** 一次性密码输入框失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 一次性密码输入框聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 一次性密码输入完成回调。 */
  onFinish?: (value: InputOtpValue) => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
