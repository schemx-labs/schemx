/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * Provider 的实例级配置只影响其后代创建的 Form；schemaConfig 和 colComponent
 * 还可由已挂载的内部 Form 响应更新，不写入 Core 模块级配置，也不改变当前
 * Vue App 的安装配置快照。
 *
 * @module config/providerConfig
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { ComputedRef, InjectionKey } from "vue"

import { mergeSchemxConfig } from "@schemx/core"

import type { SchemxVueConfig } from "../types"

/** 组件树级配置在 Vue provide/inject 中使用的私有注入 key。 */
const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<SchemxVueConfig>> = Symbol(
  "schemx:config-provider"
)

/**
 * 向当前组件的后代提供合并后的组件树级配置。
 *
 * @param config - 当前 Provider 的配置快照。
 */
export function provideSchemxConfigProvider(config: ComputedRef<SchemxVueConfig>): void {
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
 * 读取最近祖先 ConfigProvider 的配置。
 *
 * @returns 最近 Provider 的配置；不在组件 setup 上下文中时返回 undefined。
 */
export function getSchemxConfigProvider(): SchemxVueConfig | undefined {
  return getSchemxConfigProviderRef()?.value
}

/**
 * 读取最近 Provider 的响应式配置引用。
 *
 * Form 需要保留该引用，才能在 Provider 的展示配置变化后同步更新已有实例。
 * 该入口仅供 Vue 适配层内部使用；实例级 Registry 和 adapter 仍在创建时解析。
 */
export function getSchemxConfigProviderRef(): ComputedRef<SchemxVueConfig> | undefined {
  if (getCurrentInstance() === null) {
    return undefined
  }

  return inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)
}
