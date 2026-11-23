/**
 * 复选框渲染器统一导出
 *
 * @module renderers/CheckboxRenderer
 */
import { WithRemoteOptions } from "@schemx/vue"

import CheckboxRendererComponent from "./index.vue"

export default WithRemoteOptions(CheckboxRendererComponent)
export type { CheckboxOption, CheckboxRendererProps, CheckboxValue } from "./types"
