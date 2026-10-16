/**
 * schemx 组件导出
 *
 * 为基础组件和 UI 适配组件统一挂载 install、Field，
 * 并作为默认导出。
 *
 * @module formExport
 */

import type { App } from "vue"

import Field from "./components/Field"
import { provideSchemxAppConfig } from "./context/configProviderContext"
import SchemxForm from "./formRuntime.js"

import type { CreateSchemxOptions } from "@schemx/core"

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
export interface SchemxInstallOptions extends CreateSchemxOptions {}

/**
 * 挂载了 Vue 插件安装方法和 `Field` 子组件的 Form 组件类型。
 */
export type SchemxFormPlugin = typeof SchemxForm & {
  install: (app: App, options?: SchemxInstallOptions) => void
  Field: typeof Field
}

/**
 * 为指定 Form 组件挂载插件属性，安装时注册该组件自身。
 * @param component - 待安装的组件定义，插件属性直接挂载到该定义。
 * @example const Form = withInstall(SchemxForm)
 */
export function withInstall(component: typeof SchemxForm): SchemxFormPlugin {
  /**
   * 显式配置作用于当前 App，省略时保留已有配置。
   * @param app - 目标 Vue App。
   * @param options - 当前 App 的共享配置。
   */
  const install = (app: App, options?: SchemxInstallOptions): void => {
    if (options !== undefined) {
      provideSchemxAppConfig(app, options)
    }

    app.component("SchemxForm", component)
  }

  return Object.assign(component, { install, Field })
}

export default withInstall(SchemxForm)
