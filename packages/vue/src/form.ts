/**
 * schemx 组件导出
 *
 * 为基础组件和 UI 适配组件统一挂载 install、Field，
 * 并作为默认导出。
 *
 * @module formExport
 */

import { withInstall } from "./adapter"
import SchemxForm from "./formRuntime.js"

// 保留原有模块出口，安装实现由 adapter 入口统一提供。
export { withInstall } from "./adapter"
export type { SchemxFormPlugin, SchemxInstallOptions } from "./adapter"

export default withInstall(SchemxForm)
