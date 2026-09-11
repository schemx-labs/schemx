/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * @module context/configProviderContext
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { ComputedRef, InjectionKey } from "vue"

import { mergeSchemxConfig } from "@schemx/core"

import type { SchemxVueConfig } from "../types"

const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<SchemxVueConfig>> = Symbol(
  "schemx:config-provider"
)

/**
 * 创建并注入合并后的组件树级配置上下文。
 */
export function createConfigProviderContext(config: ComputedRef<SchemxVueConfig>): void {
  const parentConfig = inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)

  const mergedConfig = computed<SchemxVueConfig>(() => {
    const mergedCoreConfig = mergeSchemxConfig(config.value, parentConfig?.value ?? {})

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
