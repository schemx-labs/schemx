/** VirtualizedSelect Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import VirtualizedSelectRendererComponent from "./index.vue"

export default WithRemoteOptions(VirtualizedSelectRendererComponent)
export type {
  VirtualizedSelectOption,
  VirtualizedSelectRendererInstance,
  VirtualizedSelectRendererProps,
  VirtualizedSelectValue,
} from "./types"
