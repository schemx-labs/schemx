/** Autocomplete Renderer 统一导出。 */

import { WithRemoteOptions } from "@schemx/vue"

import AutocompleteRendererComponent from "./index.vue"

export default WithRemoteOptions(AutocompleteRendererComponent)
export type {
  AutocompleteOption,
  AutocompleteOptionProps,
  AutocompleteRendererInstance,
  AutocompleteRendererProps,
  AutocompleteSuggestions,
  AutocompleteValue,
} from "./types"
