/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * @module context/configProviderContext
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { App, ComputedRef, InjectionKey } from "vue"

import { mergeConfig } from "@schemx/core"

import type { CreateSchemxOptions } from "@schemx/core"

const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<CreateSchemxOptions>> = Symbol(
  "schemx:config-provider"
)

/**
 * 将安装配置作为当前 Vue App 的根配置上下文。
 *
 * `schemaConfig`、`rendererProps` 和 adapter 列表会复制并冻结受管层级。
 * 扩展字段与 Registry 实例保留原引用。
 *
 * @param app - 要提供配置的 Vue App。
 * @param config - 该 App 的默认 Schemx 配置。
 *
 * @example
 * ```ts
 * const app = createApp(App)
 * provideSchemxAppConfig(app, { schemaConfig: { readonly: true } })
 * app.mount("#app")
 * ```
 */
export function provideSchemxAppConfig(app: App, config: CreateSchemxOptions = {}): void {
  const snapshot = mergeConfig(config)

  app.provide(
    SCHEMX_CONFIG_PROVIDER_KEY,
    computed<CreateSchemxOptions>(() => snapshot)
  )
}

/**
 * 创建并注入合并后的组件树级配置上下文。
 *
 * 子级提供的配置优先于父级；省略的配置项沿用最近祖先的值。
 * 此处仅合并 Provider/App 来源，Vue 默认值在表单创建边界追加。
 *
 * @param config - 当前 ConfigProvider 的响应式配置。
 *
 * @example
 * ```ts
 * setup() {
 *   const config = computed(() => ({ schemaConfig: { readonly: true } }))
 *   provideConfigProviderContext(config)
 * }
 * ```
 */
export function provideConfigProviderContext(
  config: ComputedRef<CreateSchemxOptions>
): void {
  const parentConfig = inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)

  const mergedConfig = computed<CreateSchemxOptions>(() => {
    return mergeConfig(config.value, parentConfig?.value ?? {})
  })

  provide(SCHEMX_CONFIG_PROVIDER_KEY, mergedConfig)
}

/**
 * 提供配置的旧入口。
 * @deprecated 业务侧请使用 ConfigProvider 组件。
 * @param config - 当前组件的响应式配置。
 * @example createConfigProviderContext(computed(() => ({ schemaConfig: {} })))
 */
export function createConfigProviderContext(
  config: ComputedRef<CreateSchemxOptions>
): void {
  provideConfigProviderContext(config)
}

/**
 * 获取最近祖先 ConfigProvider 的当前配置。
 * @deprecated 请改用 useConfigProviderContextRef()?.value。
 *
 * @returns 最近 Provider 的配置；没有 Provider 时返回 `undefined`。
 *
 * @example
 * ```ts
 * setup() {
 *   const config = useConfigProviderContext()
 *   return { config }
 * }
 * ```
 */
export function useConfigProviderContext(): CreateSchemxOptions | undefined {
  return useConfigProviderContextRef()?.value
}

/**
 * 获取最近祖先 ConfigProvider 的响应式配置引用。
 *
 * 只能在 Vue 组件实例中读取；其他调用位置返回 `undefined`。
 *
 * @returns 最近 Provider 的响应式配置；没有组件实例或 Provider 时返回 `undefined`。
 *
 * @example
 * ```ts
 * setup() {
 *   const config = useConfigProviderContextRef()
 *   return { config }
 * }
 * ```
 */
export function useConfigProviderContextRef():
  | ComputedRef<CreateSchemxOptions>
  | undefined {
  if (getCurrentInstance() === null) {
    return undefined
  }

  return inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)
}
