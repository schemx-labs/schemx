import type { Values } from "../types"
import type { SchemxConfig } from "./types"

/**
 * `createSchemx` 的工厂入参，与共享默认配置使用同一契约。
 *
 * @typeParam TValues - Schema 默认值和 Renderer 配置关联的表单值类型。
 */
export type CreateSchemxOptions<TValues extends Values = Values> = SchemxConfig<TValues>
