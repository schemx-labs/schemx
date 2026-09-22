/** Select Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import SelectRendererComponent from "./index.vue"

export default WithRemoteOptions(SelectRendererComponent)
export type {
  SelectOption,
  SelectRendererInstance,
  SelectRendererProps,
  SelectValue,
} from "./types"
