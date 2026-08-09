/**
 * schemx 组件导出
 *
 * 为 SchemxForm 组件挂载静态方法（install、FormItem、registerRequest 等），
 * 并作为默认导出。
 *
 * @module formExport
 */

import type { App } from "vue"

import FormItem from "./components/FormItem"
import { provideSchemxAppConfig } from "./config"
import SchemxForm from "./formRuntime.js"

import type { SchemxConfig } from "@schemx/core"

/**
 * SchemxForm 插件安装选项
 *
 * 在 `app.use(SchemxForm, options)` 时传入，用于配置当前 Vue App 的默认行为。
 * 安装配置不会写入 Core 的模块级全局配置，因此多个 Vue App 可以彼此隔离。
 *
 * @example
 * ```ts
 * import SchemxForm from '@schemx/vue'
 *
 * app.use(SchemxForm, {
 *   schemaConfig: { readonly: true },
 * })
 * ```
 */
export interface SchemxInstallOptions extends SchemxConfig {}

/**
 * 为组件挂载静态属性并保留原始类型
 *
 * @param comp - 原始组件
 * @param extra - 要挂载的静态属性
 * @typeParam TComponent - 原始组件类型。
 * @typeParam TExtras - 待挂载的静态属性类型。
 */
export function withInstall<
  TComponent extends object,
  TExtras extends Record<string, unknown>,
>(comp: TComponent, extra: TExtras) {
  return Object.assign(comp, extra) as TComponent & TExtras
}

export type SchemxFormPlugin = typeof SchemxForm & {
  install: (app: App, options?: SchemxInstallOptions) => void
  FormItem: typeof FormItem
}

const SchemxFormExport = withInstall(SchemxForm, {
  /** Vue 插件安装方法 */
  install(app: App, options: SchemxInstallOptions = {}) {
    provideSchemxAppConfig(app, options)
    app.component("SchemxForm", SchemxForm)
  },
  /** FormItem 子组件引用 */
  FormItem,
}) as unknown as SchemxFormPlugin

export default SchemxFormExport
