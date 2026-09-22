/**
 * Vant 默认渲染器注册。
 *
 * `config/defaultConfig` 将该映射注册到 `@schemx/vue` 的模块级 Registry，
 * 因此两个包共用同一个 Renderer Registry。
 *
 * @module renderers/defaultRenderers
 */

import {
  CalendarRenderer,
  CascaderRenderer,
  CheckboxRenderer,
  DateRenderer,
  InputRenderer,
  NumberRenderer,
  PickerRenderer,
  RadioRenderer,
  RateRenderer,
  SelectorRenderer,
  SelectPickerRenderer,
  SensitiveInputRenderer,
  SliderRenderer,
  StepperRenderer,
  SwitchRenderer,
  TextAreaRenderer,
  TextRenderer,
  UploadRenderer,
} from "../renderers"

/** 按 Schemx Renderer key 映射到 Vant 组件的默认集合。 */
export const defaultRenderers = {
  input: InputRenderer,
  text: TextRenderer,
  textarea: TextAreaRenderer,
  number: NumberRenderer,
  switch: SwitchRenderer,
  radio: RadioRenderer,
  checkbox: CheckboxRenderer,
  date: DateRenderer,
  calendar: CalendarRenderer,
  picker: PickerRenderer,
  selectPicker: SelectPickerRenderer,
  selector: SelectorRenderer,
  sensitiveInput: SensitiveInputRenderer,
  rate: RateRenderer,
  slider: SliderRenderer,
  stepper: StepperRenderer,
  upload: UploadRenderer,
  cascader: CascaderRenderer,
}
