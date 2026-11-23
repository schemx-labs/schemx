/**
 * @schemx/vant 入口
 *
 * Vant 渲染器适配包，导入时自动将 Vant 渲染器注册到
 * @schemx/vue 的全局 rendererRegistry 实例中。
 *
 * @module @schemx/vant
 */

import "@/styles/index.scss"

/** 声明合并 side-effect：注册 Vant 渲染器类型到 SchemxRendererDefinition */
import "./types/schemx"

/** side-effect：聚合 @schemx/vue 基础表单样式到 @schemx/vant/style.css */
import "@schemx/vue/style.css"

/** side-effect：将 Vant 渲染器注册到全局 rendererRegistry */
import "./renderers/defaultRenderers"

/** 重新导出 @schemx/vue（含 SchemxForm 默认导出） */
export { default } from "@schemx/vue"
export { default as SchemxForm } from "@schemx/vue"
export {
  useForm,
  useField,
  useWatch,
  useEffect,
  useFieldContext,
  WithRemoteOptions,
  rendererRegistry,
  validatorRegistry,
} from "@schemx/vue"

/** 重新导出 @schemx/core 的类型 */
export * from "@schemx/core"

/** 渲染器组件 */
export * from "./renderers"

export { default as Cell } from "@/components/Cell/index.vue"

/** 工具函数 */
export { getFieldProps, findTreeItem, getFileName } from "./utils"
export type { FindTreeItemResult } from "./utils"
