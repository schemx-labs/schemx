/** Radio Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import RadioRendererComponent from "./index.vue"

export default WithRemoteOptions(RadioRendererComponent)
export type { RadioOption, RadioRendererProps, RadioValue } from "./types"
