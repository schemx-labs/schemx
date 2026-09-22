/** Checkbox Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import CheckboxRendererComponent from "./index.vue"

export default WithRemoteOptions(CheckboxRendererComponent)
export type { CheckboxOption, CheckboxRendererProps, CheckboxValue } from "./types"
