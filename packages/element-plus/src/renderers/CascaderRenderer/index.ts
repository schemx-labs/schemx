/** Cascader Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import CascaderRendererComponent from "./index.vue"

export default WithRemoteOptions(CascaderRendererComponent)
export type { CascaderRendererProps, CascaderValueType } from "./types"
