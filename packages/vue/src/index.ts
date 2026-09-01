/**
 * schemx 统一导出入口
 *
 * @module @schemx/vue
 */

import "./styles/index.css"

/** 默认导出 */
export { default } from "./form"
export { default as schemxForm } from "./form"
export type { SchemxInstallOptions } from "./form"

/** 全局渲染器注册实例 */
export { rendererRegistry } from "./utils/rendererProvider"

/** 全局预设规则注册实例 */
export { presetRuleRegistry } from "./utils/presetRuleProvider"

/** Hooks */
export * from "./hooks"

/** 高阶组件 */
export { WithRemoteOptions } from "./hocs"

/** 组件 */
export { default as Field } from "./components/Field"
export { default as Group } from "./components/Group"

/** schemx/core 导出 */
export * from "@schemx/core"

/** Types */
export * from "./types"
