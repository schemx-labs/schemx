import { normalizeSchemxConfig } from "./index"

import type { SchemxConfig } from "./index"

export type { SchemxConfig, SchemxConfigDefinition } from "./index"

// 模块级全局配置；由 configureSchemx() 替换，供后续 Form 创建调用继承。
const EMPTY_SCHEMX_CONFIG = normalizeSchemxConfig({})

let globalConfig: SchemxConfig = EMPTY_SCHEMX_CONFIG

/**
 * 配置 Schemx 的模块级全局默认行为。
 *
 * 该 API 只作用于当前模块级全局配置，不绑定 UI 适配包、Vue App 或组件树作用域。
 * 每次调用都会替换此前的全局配置；无参数调用会清空全局配置。
 * 多个 Vue App 或 SSR 场景应使用 App/ConfigProvider/Form 级配置，避免共享全局状态。
 *
 * @deprecated 请使用 @schemx/core 的 createSchemx 创建独立默认配置实例。
 * @param nextConfig - 替换当前模块级默认配置的配置对象；省略时清空配置。
 *
 * @example
 * ```ts
 * configureSchemx({ schemaConfig: { readonly: true } })
 * ```
 */
export function configureSchemx(nextConfig: SchemxConfig = {}): void {
  globalConfig = normalizeSchemxConfig(nextConfig)
}

/**
 * 读取当前模块级全局配置。
 *
 * @deprecated 请使用 Core 工厂实例的 getConfig。
 * @returns 当前已标准化的全局配置快照。
 *
 * @example
 * ```ts
 * const config = getGlobalSchemxConfig()
 * console.log(config.schemaConfig)
 * ```
 */
export function getGlobalSchemxConfig(): SchemxConfig {
  return globalConfig
}
