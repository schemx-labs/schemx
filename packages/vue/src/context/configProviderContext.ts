/**
 * Vue 组件树级 Schemx 配置的 provide/inject 适配。
 *
 * @module context/configProviderContext
 */

import { computed, getCurrentInstance, inject, provide } from "vue"
import type { App, ComputedRef, InjectionKey } from "vue"

import { mergeConfig } from "@schemx/core"

import type { SchemxConfig, SchemxRendererPropsMap } from "@schemx/core"

const SCHEMX_CONFIG_PROVIDER_KEY: InjectionKey<ComputedRef<SchemxConfig>> = Symbol(
  "schemx:config-provider"
)

/**
 * 复制并冻结 Core 配置的受管外层；扩展字段和 Registry 实例保留原引用。
 *
 * @param config - 当前 Vue App 的默认配置。
 * @returns 受管外层与调用方输入隔离的只读配置快照。
 */
function normalizeSchemxAppConfig(config: SchemxConfig): SchemxConfig {
  const schemaConfig = Object.freeze({ ...(config.schemaConfig ?? {}) })

  const validatorAdapters = Object.freeze([...(config.validatorAdapters ?? [])])

  return Object.freeze({
    ...config,
    schemaConfig,
    rendererProps: normalizeRendererProps(config.rendererProps),
    validatorAdapters,
  })
}

/**
 * 浅复制 Renderer Props Map 外层及每个 Renderer 的 Props 对象。
 *
 * @param source - 待复制的 Renderer Props Map。
 * @returns 新的 Renderer Props Map；嵌套 Prop 值保留原引用。
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
export function provideSchemxAppConfig(app: App, config: SchemxConfig = {}): void {
  const normalizedConfig = normalizeSchemxAppConfig(config)

  app.provide(
    SCHEMX_CONFIG_PROVIDER_KEY,
    computed<SchemxConfig>(() => normalizedConfig)
  )
}

/**
 * 创建并注入合并后的组件树级配置上下文。
 *
 * 子级提供的配置优先于父级；省略的配置项沿用最近祖先的值。
 *
 * @param config - 当前 ConfigProvider 的响应式配置。
 *
 * @example
 * ```ts
 * setup() {
 *   const config = computed(() => ({ schemaConfig: { readonly: true } }))
 *   createConfigProviderContext(config)
 * }
 * ```
 */
export function createConfigProviderContext(config: ComputedRef<SchemxConfig>): void {
  const parentConfig = inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)

  const mergedConfig = computed<SchemxConfig>(() => {
    const mergedCoreConfig = mergeConfig(config.value, parentConfig?.value ?? {})

    const parentRow = parentConfig?.value.row

    const localRow = config.value.row

    return {
      ...mergedCoreConfig,
      colComponent: config.value.colComponent ?? parentConfig?.value.colComponent,
      rowComponent: config.value.rowComponent ?? parentConfig?.value.rowComponent,
      iconComponent: config.value.iconComponent ?? parentConfig?.value.iconComponent,
      row:
        localRow === undefined
          ? parentRow
          : {
              ...parentRow,
              ...localRow,
            },
    }
  })

  provide(SCHEMX_CONFIG_PROVIDER_KEY, mergedConfig)
}

/**
 * 获取最近祖先 ConfigProvider 的当前配置。
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
export function useConfigProviderContext(): SchemxConfig | undefined {
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
export function useConfigProviderContextRef(): ComputedRef<SchemxConfig> | undefined {
  if (getCurrentInstance() === null) {
    return undefined
  }

  return inject(SCHEMX_CONFIG_PROVIDER_KEY, undefined)
}
