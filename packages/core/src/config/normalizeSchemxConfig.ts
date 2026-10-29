import { mergeConfig } from "./mergeSchemxConfig"

import type { Values } from "../types"
import type { SchemxConfig } from "./types"

/**
 * 通过统一合并规则捕获旧全局配置，保留空 Schema 和 adapter 容器。
 * @typeParam TValues - 当前表单值类型。
 * @param source - 待捕获的共享配置。
 * @returns 复制并冻结受管层级的共享配置快照。
 * @example const snapshot = normalizeSchemxConfig({ schemaConfig: { readonly: true } })
 */
export function normalizeSchemxConfig<TValues extends Values = Values>(
  source: SchemxConfig<TValues>
): SchemxConfig<TValues> {
  return mergeConfig(source, { schemaConfig: {}, validatorAdapters: [] })
}
