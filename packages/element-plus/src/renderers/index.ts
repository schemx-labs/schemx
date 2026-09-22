/** Element Plus Renderer 公共导出。 */

export { default as InputRenderer } from "./InputRenderer"
export { default as InputNumberRenderer } from "./InputNumberRenderer"
export { default as SwitchRenderer } from "./SwitchRenderer"
export { default as RadioRenderer } from "./RadioRenderer"
export { default as CheckboxRenderer } from "./CheckboxRenderer"
export { default as DatePickerRenderer } from "./DatePickerRenderer"
export { default as CascaderRenderer } from "./CascaderRenderer"
export { default as SensitiveInputRenderer } from "./SensitiveInputRenderer"
export { default as RateRenderer } from "./RateRenderer"
export { default as SliderRenderer } from "./SliderRenderer"
export { default as UploadRenderer } from "./UploadRenderer"
export { default as AutocompleteRenderer } from "./AutocompleteRenderer"
export { default as ColorPickerRenderer } from "./ColorPickerRenderer"
export { default as DateTimePickerRenderer } from "./DateTimePickerRenderer"
export { default as InputTagRenderer } from "./InputTagRenderer"
export { default as InputOtpRenderer } from "./InputOtpRenderer"
export { default as MentionRenderer } from "./MentionRenderer"
export { default as SelectRenderer } from "./SelectRenderer"
export { default as VirtualizedSelectRenderer } from "./VirtualizedSelectRenderer"
export { default as TimePickerRenderer } from "./TimePickerRenderer"
export { default as TimeSelectRenderer } from "./TimeSelectRenderer"
export { default as TreeSelectRenderer } from "./TreeSelectRenderer"

export type { InputRendererProps, InputValue } from "./InputRenderer"
export type { InputNumberRendererProps, InputNumberValue } from "./InputNumberRenderer"
export type { SwitchRendererProps, SwitchValue } from "./SwitchRenderer"
export type { RadioOption, RadioRendererProps, RadioValue } from "./RadioRenderer"
export type {
  CheckboxOption,
  CheckboxRendererProps,
  CheckboxValue,
} from "./CheckboxRenderer"
export type { DatePickerRendererProps, DatePickerValue } from "./DatePickerRenderer"
export type { CascaderRendererProps, CascaderValueType } from "./CascaderRenderer"
export type {
  SensitiveInputRendererProps,
  SensitiveInputValue,
} from "./SensitiveInputRenderer"
export type { RateRendererProps, RateValue } from "./RateRenderer"
export type { SliderRendererProps, SliderValue } from "./SliderRenderer"
export type {
  UploadFile,
  UploadListType,
  UploadRendererProps,
  UploadRuntimeFile,
  UploadValue,
} from "./UploadRenderer"
export type {
  AutocompleteOption,
  AutocompleteOptionProps,
  AutocompleteRendererInstance,
  AutocompleteRendererProps,
  AutocompleteSuggestions,
  AutocompleteValue,
} from "./AutocompleteRenderer"
export type { ColorPickerRendererProps, ColorPickerValue } from "./ColorPickerRenderer"
export type {
  DateTimePickerRendererProps,
  DateTimePickerType,
  DateTimePickerValue,
} from "./DateTimePickerRenderer"
export type { InputTagRendererProps, InputTagValue } from "./InputTagRenderer"
export type { InputOtpRendererProps, InputOtpValue } from "./InputOtpRenderer"
export type {
  MentionOptionItem,
  MentionRendererInstance,
  MentionRendererProps,
  MentionValue,
} from "./MentionRenderer"
export type {
  SelectOption,
  SelectRendererInstance,
  SelectRendererProps,
  SelectValue,
} from "./SelectRenderer"
export type {
  VirtualizedSelectOption,
  VirtualizedSelectRendererInstance,
  VirtualizedSelectRendererProps,
  VirtualizedSelectValue,
} from "./VirtualizedSelectRenderer"
export type { TimePickerRendererProps, TimePickerValue } from "./TimePickerRenderer"
export type { TimeSelectRendererProps, TimeSelectValue } from "./TimeSelectRenderer"
export type {
  TreeSelectOption,
  TreeSelectRendererProps,
  TreeSelectValue,
} from "./TreeSelectRenderer"

/** Element Plus 适配包注册的默认 Renderer 类型。 */
export const DEFAULT_RENDERER_TYPES = [
  "input",
  "inputNumber",
  "switch",
  "radio",
  "checkbox",
  "datePicker",
  "cascader",
  "sensitiveInput",
  "rate",
  "slider",
  "upload",
  "autocomplete",
  "colorPicker",
  "datetimePicker",
  "inputTag",
  "inputOtp",
  "mention",
  "select",
  "virtualizedSelect",
  "timePicker",
  "timeSelect",
  "treeSelect",
] as const
