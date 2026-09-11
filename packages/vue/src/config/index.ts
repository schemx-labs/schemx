/**
 * Vue 配置入口。
 *
 * @module config
 */

/**
 * Vue App 安装配置。
 */
export { provideSchemxAppConfig, getSchemxAppConfig } from "./appConfig"

/**
 * Vue Form 配置合并。
 */
export { mergeVueSchemxConfig } from "./vueConfig"

/**
 * Vue 字段展示默认配置。
 */
export {
  defaultVueSchemaConfig,
  defaultVueSchemaConfigKeys,
} from "./defaultVueSchemaConfig"
