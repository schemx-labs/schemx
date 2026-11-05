import type { App } from "vue"

import Field from "../components/Field"
import { provideSchemxAppConfig } from "../context"

import type { SchemxInstallOptions } from "./install"
import type SchemxSearch from "../searchRuntime.js"

/**
 * 可安装且保留业务值泛型的搜索组件。
 */
export type SchemxSearchPlugin = typeof SchemxSearch & {
  /**
   * 将当前 Search 注册到 App，并按需提供 App 默认配置。
   * @param app - 目标 Vue App。
   * @param options - 当前 App 共享的表单配置。
   */
  install: (app: App, options?: SchemxInstallOptions) => void
  /**
   * 与 Form 使用同一字段组件。
   */
  Field: typeof Field
}

/**
 * 给 Search 定义挂载插件能力，不改变 Form 的安装行为。
 * @param component - 待安装的搜索组件定义。
 * @example const Search = withSearchInstall(SchemxSearch)
 */
export function withSearchInstall(component: typeof SchemxSearch): SchemxSearchPlugin {
  /**
   * 注册本次绑定的 Search 定义，安装配置只作用于当前 App。
   * @param app - 目标 Vue App。
   * @param options - 可选的 App 默认配置。
   */
  const install = (app: App, options?: SchemxInstallOptions): void => {
    if (options !== undefined) {
      provideSchemxAppConfig(app, options)
    }

    app.component("SchemxSearch", component)
  }

  return Object.assign(component, { install, Field })
}
