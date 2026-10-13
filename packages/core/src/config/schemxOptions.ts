import type { CreateFormOptions } from "../form/options"
import type { Values } from "../types"
import type { SchemxConfig } from "./schemxConfig"

/**
 * 工厂、App 和 Provider 可共享的表单创建默认值。
 *
 * @typeParam TValues - Schema 默认值和 Renderer 配置关联的表单值类型。
 */
export type CreateSchemxOptions<TValues extends Values = Values> = SchemxConfig<TValues> &
  Readonly<
    Pick<
      CreateFormOptions<TValues>,
      "debug" | "schedulerOptions" | "validationConcurrency"
    >
  >
