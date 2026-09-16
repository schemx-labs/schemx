/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * @module context/configProviderContext
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { App, ComputedRef, InjectionKey } from "vue"

import { mergeConfig } from "@schemx/core"

import type { SchemxVueConfig } from "../types"
import type { SchemxRendererPropsMap } from "@schemx/core"

const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<SchemxVueConfig>> = Symbol(
  "schemx:config-provider"
)

/**
 * 将安装选项复制为与调用方输入隔离的只读配置快照。
 */
function normalizeSchemxAppConfig(config: SchemxVueConfig): SchemxVueConfig {
  const schemaConfig = Object.freeze({ ...(config.schemaConfig ?? {}) })

  const validatorAdapters = Object.freeze([...(config.validatorAdapters ?? [])])

  return Object.freeze({
    schemaConfig,
    rendererProps: normalizeRendererProps(config.rendererProps),
    validatorAdapters,
    defaultRendererType: config.defaultRendererType,
    rendererRegistry: config.rendererRegistry,
    presetRuleRegistry: config.presetRuleRegistry,
    colComponent: config.colComponent,
  })
}

/**
 * 复制 Renderer Props Map 外层及每个 Renderer 的 Props 对象。
 */
function normalizeRendererProps(
  source: SchemxRendererPropsMap | undefined
): SchemxRendererPropsMap | undefined {
  if (source === undefined) {
    return undefined
  }

  const entries = Object.entries(source).map(([type, props]) => {
    return [type, props === undefined ? undefined : Object.freeze({ ...props })]
  })

  return Object.freeze(Object.fromEntries(entries)) as SchemxRendererPropsMap
}

/**
 * 将安装配置作为当前 Vue App 的根配置上下文。
 */
export function provideSchemxAppConfig(app: App, config: SchemxVueConfig = {}): void {
  const normalizedConfig = normalizeSchemxAppConfig(config)

  app.provide(
    SCHEMX_CONFIG_PROVIDER_KEY,
    computed<SchemxVueConfig>(() => normalizedConfig)
  )
}

/**
 * 创建并注入合并后的组件树级配置上下文。
 */
export function createConfigProviderContext(config: ComputedRef<SchemxVueConfig>): void {
  const parentConfig = inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)

  const mergedConfig = computed<SchemxVueConfig>(() => {
    const mergedCoreConfig = mergeConfig(config.value, parentConfig?.value ?? {})

    return {
      ...mergedCoreConfig,
      colComponent: config.value.colComponent ?? parentConfig?.value.colComponent,
    }
  })

  provide(SCHEMX_CONFIG_PROVIDER_KEY, mergedConfig)
}

/**
 * 获取最近祖先 ConfigProvider 的当前配置。
 */
export function useConfigProviderContext(): SchemxVueConfig | undefined {
  return useConfigProviderContextRef()?.value
}

/**
 * 获取最近祖先 ConfigProvider 的响应式配置引用。
 */
export function useConfigProviderContextRef(): ComputedRef<SchemxVueConfig> | undefined {
  if (getCurrentInstance() === null) {
    return undefined
  }

  return inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)
}
