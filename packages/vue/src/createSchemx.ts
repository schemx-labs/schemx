import { createSchemx as createCoreSchemx, mergeConfig } from "@schemx/core"

import { defaultConfig } from "./config/defaultConfig"
import { presetRuleRegistry } from "./utils/presetRuleProvider"
import { rendererRegistry } from "./utils/rendererProvider"

import type { CreateSchemxOptions, SchemxApi } from "@schemx/core"

/**
 * 创建包含 Vue 默认设置的独立 Core 工厂。
 *
 * @param config - 调用方创建基线；高于 Vue 默认值，Registry 引用沿用 Core 契约。
 * @returns Core 的五项配置与创建 API，每次调用创建新实例。
 * @example const api = createSchemx({ schemaConfig: { labelWidth: 140 } })
 */
export function createSchemx(config: CreateSchemxOptions = {}): SchemxApi {
  return createCoreSchemx(
    mergeConfig(config, {
      schemaConfig: defaultConfig,
      rendererRegistry,
      presetRuleRegistry,
    })
  )
}
