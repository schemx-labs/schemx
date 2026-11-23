/**
 * 选择渲染器统一导出
 *
 * @module renderers/PickerRenderer
 */
import { WithRemoteOptions } from "@schemx/vue"

import PickerRendererComponent from "./index.vue"

export default WithRemoteOptions(PickerRendererComponent)
export type { PickerRendererProps, PickerFieldNames, PickerValue } from "./types"
