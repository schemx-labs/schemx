/**
 * Vue 层 Form 配置合并。
 *
 * @module config/vueConfig
 */

import { mergeSchemxConfig } from "@schemx/core"

import { presetRuleRegistry as globalPresetRuleRegistry } from "../utils/presetRuleProvider"
import { rendererRegistry as globalRendererRegistry } from "../utils/rendererProvider"

import { getSchemxAppConfig } from "./appConfig"
import { getSchemxConfigProvider } from "./providerConfig"

import type { SchemxConfig, Values } from "@schemx/core"

/**
 * 按 Vue 适配层优先级合并一个 Form 的显式配置。
 *
 * Core 模块级配置和内置默认值由后续 createForm() 继续处理。
 *
 * @param localConfig - 当前 Form 或 useForm() 的显式配置。
 * @param fallbackConfig - Vue 层更低优先级的回退配置。
 * @returns 已合并 Provider、App 和 Vue 默认 Registry 的配置。
 */
export function mergeVueSchemxConfig<TValues extends Values = Values>(
  localConfig: SchemxConfig<TValues>,
  fallbackConfig: SchemxConfig<TValues> = {}
): SchemxConfig<TValues> {
  const providerConfig = getSchemxConfigProvider()

  return mergeSchemxConfig(
    localConfig,
    (providerConfig as SchemxConfig<TValues> | undefined) ?? {},
    getSchemxAppConfig() as SchemxConfig<TValues>,
    fallbackConfig,
    {
      rendererRegistry: globalRendererRegistry,
      presetRuleRegistry: globalPresetRuleRegistry,
    }
  )
}
