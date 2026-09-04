/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * Provider 配置只影响其后代创建的 Form，不写入 Core 模块级配置，也不改变
 * 当前 Vue App 的安装配置快照。
 *
 * @module config/providerConfig
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { ComputedRef, InjectionKey } from "vue"

import { mergeSchemxConfig } from "@schemx/core"

import type { SchemxConfig } from "@schemx/core"

/** 组件树级配置在 Vue provide/inject 中使用的私有注入 key。 */
const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<SchemxConfig>> = Symbol(
  "schemx:config-provider"
)

/**
 * 向当前组件的后代提供合并后的组件树级配置。
 *
 * @param config - 当前 Provider 的配置快照。
 */
export function provideSchemxConfigProvider(config: ComputedRef<SchemxConfig>): void {
  const parentConfig = inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)

  const mergedConfig = computed<SchemxConfig>(() =>
    mergeSchemxConfig(config.value, parentConfig?.value ?? {})
  )

  provide(SCHEMX_CONFIG_PROVIDER_KEY, mergedConfig)
}

/**
 * 读取最近祖先 ConfigProvider 的配置。
 *
 * @returns 最近 Provider 的配置；不在组件 setup 上下文中时返回 undefined。
 */
export function getSchemxConfigProvider(): SchemxConfig | undefined {
  if (getCurrentInstance() === null) {
    return undefined
  }

  return inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)?.value
}
