import type { Values } from "@schemx/core"
import type { SchemxBaseComponentProps } from "@schemx/vue"

/** 自定义联系人 Renderer 的字段值。 */
export interface ContactCardValue {
  name: string
  phone: string
}

/**
 * 自定义联系人 Renderer Props。
 *
 * Renderer 仍遵循 Schemx 的 onChange / onBlur / onUpdate:value 契约，
 * 内部可以自由组合多个 Vant 子控件。
 */
export interface ContactCardRendererProps<TValues extends Values = Values> extends Omit<
  SchemxBaseComponentProps<TValues>,
  "value" | "onChange" | "onBlur" | "onUpdate:value"
> {
  value?: ContactCardValue
  onChange?: (value: ContactCardValue) => void
  onBlur?: (value: ContactCardValue) => void
  "onUpdate:value"?: (value: ContactCardValue) => void
}

declare module "@schemx/core" {
  interface SchemxRendererDefinition<TValues extends Values> {
    "contact-card": ContactCardRendererProps<TValues>
  }
}
