/**
 * element-plus 适配包入口；透传 Vue 公共 API，并提供本包默认实现。
 */
import "./styles/index.scss"
import "./types/schemx"

/* eslint-disable import/export -- 显式导出本包实现，覆盖 Vue 星号导出的同名成员。 */
export * from "@schemx/vue"
export * from "./renderers"
export * from "./utils"

export { default, default as SchemxForm, default as schemxForm } from "./form"
export { createForm, configureSchemx, getConfig, useForm } from "./schemx"
export {
  defaultConfig,
  rendererRegistry,
  presetRuleRegistry,
} from "./config/defaultConfig"
/* eslint-enable import/export */
