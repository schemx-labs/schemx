/**
 * Vue App 级 Schemx 配置的 provide/inject 适配。
 *
 * 安装配置属于当前 Vue App，而不是 Core 模块级共享状态；该模块只在 Vue
 * 适配层内部保存和读取安装配置，不将注入 key 暴露为公共 API。
 *
 * @module utils/appConfig
 */

import { type App, getCurrentInstance, inject, type InjectionKey } from "vue"

import type { SchemxConfig, SchemxRendererPropsMap } from "@schemx/core"

// Vue App 级配置在组件树中的私有注入 key。
const SCHEMX_APP_CONFIG_KEY: InjectionKey<SchemxConfig> = Symbol("schemx:app-config")

// 没有安装配置时使用的不可变空配置。
const EMPTY_SCHEMX_CONFIG: SchemxConfig = Object.freeze({
  schemaConfig: Object.freeze({}),
  validatorAdapters: Object.freeze([]),
})

/**
 * 将插件安装选项复制为可安全注入的 App 配置快照。
 *
 * Registry 保留其可变实例语义，使同一 App 内创建的多个 Form 继续共享注册结果；
 * Schema 配置和 adapter 列表则复制并冻结，避免安装后修改原对象影响 App 配置。
 *
 * @param config - 插件安装时传入的配置。
 * @returns 与调用方输入隔离的 App 配置快照。
 */
function normalizeSchemxAppConfig(config: SchemxConfig): SchemxConfig {
  // 复制并冻结 App 级字段默认值，避免外部对象后续变更配置。
  const schemaConfig = Object.freeze({ ...(config.schemaConfig ?? {}) })

  // 复制并冻结 App 级 adapter 列表，保持列表与调用方数组相互独立。
  const validatorAdapters = Object.freeze([...(config.validatorAdapters ?? [])])

  return Object.freeze({
    schemaConfig,
    rendererProps: normalizeRendererProps(config.rendererProps),
    validatorAdapters,
    defaultRendererType: config.defaultRendererType,
    rendererRegistry: config.rendererRegistry,
    presetRuleRegistry: config.presetRuleRegistry,
  })
}

/**
 * 复制并冻结 Renderer Props Map 外层及每个 Renderer 的 Props 对象。
 *
 * @param source - 待标准化的 Renderer Props Map。
 * @returns 与输入隔离一层的只读 App 配置；任意嵌套 Prop 值仍保留原引用。
 */
function normalizeRendererProps(
  source: SchemxRendererPropsMap | undefined
): SchemxRendererPropsMap | undefined {
  if (source === undefined) {
    return undefined
  }

  // 每个 Renderer 的 Props 对象单独复制，避免安装后修改源对象影响当前 App。
  const entries = Object.entries(source).map(([type, props]) => {
    return [type, props === undefined ? undefined : Object.freeze({ ...props })]
  })

  return Object.freeze(Object.fromEntries(entries)) as SchemxRendererPropsMap
}

/**
 * 将 Schemx 安装配置绑定到指定 Vue App。
 *
 * @param app - 要安装 Schemx 的 Vue App 实例。
 * @param config - 当前 App 的默认配置。
 */
export function provideSchemxAppConfig(app: App, config: SchemxConfig = {}): void {
  // 当前 App 后续组件实例应读取的配置快照。
  const normalizedConfig = normalizeSchemxAppConfig(config)

  app.provide(SCHEMX_APP_CONFIG_KEY, normalizedConfig)
}

/**
 * 读取当前组件所属 Vue App 的 Schemx 安装配置。
 *
 * 在组件 setup() 之外调用时，Vue 没有可用的注入上下文；此时返回空配置，
 * 使 `useForm()` 仍可在独立 effect scope 中使用 Vue 模块级 Registry。
 *
 * @returns 当前 App 的安装配置，或无 App 上下文时的空配置。
 */
export function getSchemxAppConfig(): SchemxConfig {
  // 只有存在当前组件实例时才读取 Vue 注入上下文，避免 setup 外触发 Vue 警告。
  if (getCurrentInstance() === null) {
    return EMPTY_SCHEMX_CONFIG
  }

  // 当前组件树中最近的 App 级配置，未安装插件时回退到空配置。
  return inject(SCHEMX_APP_CONFIG_KEY, EMPTY_SCHEMX_CONFIG)
}
