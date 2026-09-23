/**
 * schemx 统一导出入口
 *
 * @module @schemx/vue
 */
import "./styles/index.css"

// 载入 Core Schema 与配置的 Vue 声明合并，使适配包消费根入口时获得完整类型。
import "./types/definition"

/**
 * 默认导出
 */
export { default } from "./form"
export { default as schemxForm } from "./form"
export type { SchemxFormPlugin, SchemxInstallOptions } from "./form"

/**
 * 全局渲染器注册实例
 */
export { rendererRegistry } from "./utils/rendererProvider"

export { normalizeSchemxGutter, type SchemxNormalizedGutter } from "./utils/layout"

/**
 * 全局预设规则注册实例
 */
export { presetRuleRegistry } from "./utils/presetRuleProvider"

/**
 * Hooks
 */
export * from "./hooks"

/**
 * Context
 */
export * from "./context"

/**
 * 高阶组件
 */
export { WithRemoteOptions } from "./hocs"

/**
 * 组件
 */
export { default as Field, type SchemxFieldProps } from "./components/Field"
export { default as Group, type SchemxGroupProps } from "./components/Group"
export { default as Col } from "./components/Col"
export { default as Row } from "./components/Row"
export { default as Icon } from "./components/Icon"
export { default as Wrapper } from "./components/Wrapper/index.vue"
export {
  default as ConfigProvider,
  type ConfigProviderProps,
} from "./components/ConfigProvider"

/**
 * schemx/core 导出
 */
/* eslint-disable import/export -- Vue 的 SchemxLayout 兼容别名需要覆盖同名 Core 类型。 */
export * from "@schemx/core"

// 显式导出 Vue 的 SchemxLayout 兼容别名，覆盖 Core 旧类型名。
export type { SchemxLayout } from "./types/layout"

/**
 * Types
 */
export * from "./types"
/* eslint-enable import/export */
