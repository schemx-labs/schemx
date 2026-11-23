/**
 * 选择组渲染器统一导出
 *
 * @module renderers/SelectorRenderer
 */
import { WithRemoteOptions } from "@schemx/vue"

import SelectorRendererComponent from "./index.vue"

export default WithRemoteOptions(SelectorRendererComponent)
export type { SelectorOption, SelectorProps, SelectorRendererProps, SelectValue } from "./types"
