/**
 * @module renderers/SelectPickerRenderer
 */
import { WithRemoteOptions } from "@schemx/vue"

import SelectPickerRendererComponent from "./index.vue"

export default WithRemoteOptions(SelectPickerRendererComponent)

export type {
  SelectPickerFieldNames,
  SelectPickerOption,
  SelectPickerRendererProps,
  SelectPickerValue,
} from "./types"
