/**
 * 单选框渲染器统一导出
 *
 * @module renderers/RadioRenderer
 */
import { WithRemoteOptions } from "@schemx/vue"

import RadioRendererComponent from "./index.vue"

export default WithRemoteOptions(RadioRendererComponent)
export type { RadioOption, RadioRendererProps, RadioValue } from "./types"
