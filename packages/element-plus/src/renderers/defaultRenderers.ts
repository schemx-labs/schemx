/**
 * Element Plus 默认 Renderer 定义。
 *
 * 该模块只导出 Renderer Map，由适配包 Runtime 注册到自己的 Registry，
 * 不在导入时修改 @schemx/vue 的模块级 Registry。
 */

import {
  AutocompleteRenderer,
  CascaderRenderer,
  CheckboxRenderer,
  ColorPickerRenderer,
  DatePickerRenderer,
  DateTimePickerRenderer,
  InputNumberRenderer,
  InputOtpRenderer,
  InputRenderer,
  InputTagRenderer,
  MentionRenderer,
  RadioRenderer,
  RateRenderer,
  SelectRenderer,
  SensitiveInputRenderer,
  SliderRenderer,
  SwitchRenderer,
  TimePickerRenderer,
  TimeSelectRenderer,
  TreeSelectRenderer,
  UploadRenderer,
  VirtualizedSelectRenderer,
} from "../renderers"

export const defaultRenderers = {
  input: InputRenderer,
  inputNumber: InputNumberRenderer,
  switch: SwitchRenderer,
  radio: RadioRenderer,
  checkbox: CheckboxRenderer,
  datePicker: DatePickerRenderer,
  cascader: CascaderRenderer,
  sensitiveInput: SensitiveInputRenderer,
  rate: RateRenderer,
  slider: SliderRenderer,
  upload: UploadRenderer,
  autocomplete: AutocompleteRenderer,
  colorPicker: ColorPickerRenderer,
  datetimePicker: DateTimePickerRenderer,
  inputTag: InputTagRenderer,
  inputOtp: InputOtpRenderer,
  mention: MentionRenderer,
  select: SelectRenderer,
  virtualizedSelect: VirtualizedSelectRenderer,
  timePicker: TimePickerRenderer,
  timeSelect: TimeSelectRenderer,
  treeSelect: TreeSelectRenderer,
}
