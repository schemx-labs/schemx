/**
 * Vant 默认渲染器注册。
 *
 * `config/defaultConfig` 将这份描述注册到适配包自己的 Registry，
 * 字段字典由 Core 根据 Schema 配置管理。
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

/**
 * 按 Schemx Renderer key 映射到组件的默认集合。
 */
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
