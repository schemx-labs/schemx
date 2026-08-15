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

/** 全局校验规则注册实例 */
export { validationRuleRegistry } from "./utils/rulesProvider"

/** Hooks */
export * from "./hooks"

/** 高阶组件 */
export { WithRemoteOptions } from "./hocs"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormGroup } from "./components/FormGroup"

/** schemx/core 导出 */
export * from "@schemx/core"

/** Types */
export * from "./types"
