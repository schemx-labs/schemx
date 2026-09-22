/**
 * Vue 层 Form 配置合并。
 *
 * @module config/vueConfig
 */

import { getGlobalSchemxConfig, mergeConfig } from "@schemx/core"

import { useConfigProviderContext } from "../context/configProviderContext"
import { presetRuleRegistry as globalPresetRuleRegistry } from "../utils/presetRuleProvider"
import { rendererRegistry as globalRendererRegistry } from "../utils/rendererProvider"

import type { SchemxConfig, Values } from "@schemx/core"

/**
 * 按优先级合并一个 Form 的显式配置、Provider/App 配置和 Core 全局配置。
 *
 * Core 内置默认值由后续 `createForm()` 补齐。
 *
 * @typeParam TValues - 用于关联 Renderer Props 的表单值类型。
 * @param localConfig - 当前 Form 或 useForm() 的显式配置。
 * @param fallbackConfig - Vue 层更低优先级的回退配置。
 * @returns 已合并 Provider、App、Core 全局配置和 Vue 默认 Registry 的配置。
 *
 * @example
 * ```ts
 * setup() {
 *   const config = mergeVueSchemxConfig({
 *     schemaConfig: { readonly: true },
 *   })
 *   return { config }
 * }
 * ```
 */
export function mergeVueSchemxConfig<TValues extends Values = Values>(
  localConfig: SchemxConfig<TValues>,
  fallbackConfig: SchemxConfig<TValues> = {}
): SchemxConfig<TValues> {
  const providerConfig = useConfigProviderContext()

  const coreConfig = getGlobalSchemxConfig() as SchemxConfig<TValues>

  return mergeConfig<TValues>(
    localConfig,
    (providerConfig as SchemxConfig<TValues> | undefined) ?? {},
    fallbackConfig,
    coreConfig,
    {
      rendererRegistry: globalRendererRegistry,
      presetRuleRegistry: globalPresetRuleRegistry,
    }
  )
}
