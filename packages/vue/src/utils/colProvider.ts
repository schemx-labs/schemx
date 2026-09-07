/**
 * Vue 层全局 Col 组件注册。
 *
 * UI 适配包通过此模块注册其 Col 实现；Form、ConfigProvider 和单个 Form 的显式
 * 配置会在渲染时覆盖该全局回退组件。
 *
 * @module utils/colProvider
 */

import { shallowRef } from "vue"

import type { SchemxColComponent } from "../types/layout"

/** 当前全局注册的 Col 组件。 */
export const registeredColComponent = shallowRef<SchemxColComponent>()

/**
 * 注册全局 Col 组件。
 *
 * 后续注册会覆盖当前全局组件；App、ConfigProvider 和 Form 的局部配置拥有更高优先级。
 *
 * @param component - UI 组件库提供的 Col 组件。
 *
 * @example
 * ```ts
 * import { Col } from "vant"
 * import { registerCol } from "@schemx/vue"
 *
 * registerCol(Col)
 * ```
 */
export function registerCol(component: SchemxColComponent): void {
  registeredColComponent.value = component
}
