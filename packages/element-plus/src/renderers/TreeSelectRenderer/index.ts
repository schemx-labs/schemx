/** TreeSelect Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import TreeSelectRendererComponent from "./index.vue"

export default WithRemoteOptions(TreeSelectRendererComponent)
export type { TreeSelectOption, TreeSelectRendererProps, TreeSelectValue } from "./types"
