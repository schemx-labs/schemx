/**
 * 级联选择器渲染器统一导出
 *
 * @module renderers/CascaderRenderer
 */

import { WithRemoteOptions } from "@schemx/vue"

import CascaderRendererComponent from "./index.vue"

export default WithRemoteOptions(CascaderRendererComponent)

export type { CascaderFieldNames, CascaderRendererProps, CascaderValue } from "./types"
