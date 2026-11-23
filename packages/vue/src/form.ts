/**
 * schemx 组件导出
 *
 * 为 SchemxForm 组件挂载静态方法（install、FormItem、registerRequest 等），
 * 并作为默认导出。
 *
 * @module formExport
 */

import type { App, DefineComponent } from "vue"

import FormItem from "./components/FormItem"
import SchemxForm from "./formRuntime.js"

import type { SchemxFormProps } from "./types"

/**
 * SchemxForm 插件安装选项
 *
 * 在 `app.use(SchemxForm, options)` 时传入，用于配置全局默认行为。
 *
 * @example
 * ```ts
 * import SchemxForm from '@schemx/vue'
 *
 * app.use(SchemxForm, {
 *   request: (url) => fetch(url).then(r => r.json()),
 * })
 * ```
 */
export interface SchemxInstallOptions {}

/**
 * 为组件挂载静态属性并保留原始类型
 *
 * @param comp - 原始组件
 * @param extra - 要挂载的静态属性
 */
export function withInstall<T extends object, E extends Record<string, unknown>>(
  comp: T,
  extra: E
) {
  return Object.assign(comp, extra) as T & E
}

export type SchemxFormPlugin = DefineComponent<SchemxFormProps> & {
  install: (app: App, options?: SchemxInstallOptions) => void
  FormItem: typeof FormItem
}

const SchemxFormExport = withInstall(SchemxForm, {
  /** Vue 插件安装方法 */
  install(app: App, _options?: SchemxInstallOptions) {
    app.component("SchemxForm", SchemxForm)
  },
  /** FormItem 子组件引用 */
  FormItem,
}) as unknown as SchemxFormPlugin

export default SchemxFormExport
