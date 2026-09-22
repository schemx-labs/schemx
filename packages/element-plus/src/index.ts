/**
 * @schemx/element-plus 入口
 *
 * Element Plus Renderer 适配包。
 *
 * @module @schemx/element-plus
 */
import "./styles/index.scss"

/** 声明合并 side-effect：注册 Element Plus Renderer 类型到 SchemxRendererDefinition */
import "./types/schemx"

/** 渲染器组件 */
export * from "./renderers"

/** 工具函数 */
export * from "./utils"

/** 重新导出 @schemx/core */
/* eslint-disable import/export -- 适配包入口 API 必须覆盖 Vue 的同名全局导出。 */
export * from "@schemx/vue"

/** 重新导出 Vue Form、Registry 和 Core API */
export { default, default as SchemxForm, useForm } from "@schemx/vue"

export { presetRuleRegistry, rendererRegistry } from "./config/defaultConfig"
/* eslint-enable import/export */
