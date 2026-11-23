/**
 * Vant 默认渲染器注册
 *
 * 导入 @schemx/vue 的全局 rendererRegistry 实例，
 * 将所有 Vant 渲染器注册进去。
 *
 * @module renderers/defaultRenderers
 */

import { rendererRegistry } from "@schemx/vue"

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
  SensitiveInputRenderer,
  SelectPickerRenderer,
  SliderRenderer,
  StepperRenderer,
  SwitchRenderer,
  TextAreaRenderer,
  TextRenderer,
  UploadRenderer,
} from "../renderers"

rendererRegistry.registerAll({
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
})
