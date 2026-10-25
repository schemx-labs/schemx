/**
 * adapter 模块统一入口。
 */

export { bindFormCreator, getFormCreator } from "./formCreators"

export { createFormComponent } from "./createFormComponent"
// 安装能力与默认组件导出分开，创建器加载不执行默认组件的安装。
export { withInstall } from "./install"
export type { SchemxFormPlugin, SchemxInstallOptions } from "./install"
