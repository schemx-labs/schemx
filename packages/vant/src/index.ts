/**
 * @schemx/vant 入口
 *
 * Vant 渲染器适配包，导入时自动将 Vant 渲染器注册到
 * @schemx/vue 的全局 rendererRegistry 实例中。
 *
 * @module @schemx/vant
 */
import "./styles/index.scss"

/** side-effect：将 Vant Col 注册到 @schemx/vue 的全局布局组件。 */
import "./layout/defaultCol"

/** 声明合并 side-effect：注册 Vant 渲染器类型到 SchemxRendererDefinition */
import "./types/schemx"

/** side-effect：将 Vant 渲染器注册到全局 rendererRegistry */
import "./renderers/defaultRenderers"

/** 渲染器组件 */
export * from "./renderers"

/** 工具函数 */
export * from "./utils"

/** 重新导出 @schemx/vue（含 SchemxForm 默认导出） */
export { default } from "@schemx/vue"
export { default as SchemxForm } from "@schemx/vue"

/** 重新导出 @schemx/core */
export * from "@schemx/vue"
