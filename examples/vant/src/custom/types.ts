import type { Values } from "@schemx/core"
import type { SchemxBaseComponentProps } from "@schemx/vue"

/** 自定义联系人 Renderer 的字段值。 */
export interface ContactCardValue {
  /** 联系人姓名。 */
  name: string
  /** 联系人电话。 */
  phone: string
}

/**
 * 自定义联系人 Renderer Props。
 *
 * Renderer 仍遵循 Schemx 的 onChange / onBlur / onUpdate:value 契约，
 * 内部可以自由组合多个 Vant 子控件。
 * Vue 编译器不展开公共基类；组件实际读取的属性需在此显式声明，
 * 其余继承属性仅保留 TypeScript 契约，运行时作为 attrs 接收。
 *
 * @typeParam TValues - 所属表单的值类型。
 */
export interface ContactCardRendererProps<
  TValues extends Values = Values,
> extends /* @vue-ignore */ Omit<
  SchemxBaseComponentProps<TValues>,
  "value" | "onChange" | "onBlur" | "onUpdate:value"
> {
  /** 是否禁用联系人输入及示例填充。 */
  disabled?: boolean
  /** 是否只读，禁止编辑及示例填充。 */
  readonly?: boolean
  /** 当前联系人字段值。 */
  value?: ContactCardValue
  /**
   * 提交联系人变化。
   * @param value - 最新的完整联系人信息。
   */
  onChange?: (value: ContactCardValue) => void
  /**
   * 通知联系人输入失焦。
   * @param value - 失焦时的完整联系人信息。
   */
  onBlur?: (value: ContactCardValue) => void
  /**
   * 同步 Vue v-model 字段值。
   * @param value - 最新的完整联系人信息。
   */
  "onUpdate:value"?: (value: ContactCardValue) => void
}

declare module "@schemx/core" {
  interface SchemxRendererDefinition<TValues extends Values> {
    "contact-card": ContactCardRendererProps<TValues>
  }
}
