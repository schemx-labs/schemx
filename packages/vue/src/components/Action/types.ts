import type { SchemxFormProps } from "../../types"
import type { SchemxInstance, Values } from "@schemx/core"

/**
 * 操作区复用表单的按钮与展示配置，并接收当前表单实例。
 * @typeParam TValues - 当前表单值类型。
 */
export interface ActionProps<TValues extends Values> extends Pick<
  SchemxFormProps<TValues>,
  "actionCol" | "loading" | "submitter" | "resetter"
> {
  /**
   * 提交、重置及操作插槽使用的当前表单实例。
   */
  form: SchemxInstance<TValues>
}
