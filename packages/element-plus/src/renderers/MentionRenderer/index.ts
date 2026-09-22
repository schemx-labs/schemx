/** Mention Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import MentionRendererComponent from "./index.vue"

export default WithRemoteOptions(MentionRendererComponent)
export type {
  MentionOptionItem,
  MentionRendererInstance,
  MentionRendererProps,
  MentionValue,
} from "./types"
