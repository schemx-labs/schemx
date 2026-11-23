/**
 * schemx 渲染器类型声明合并
 *
 * 将 Wot UI 渲染器的 componentType 和 componentProps 注册到 schemx 类型系统，
 * 使 schemas 配置获得完整的类型提示。
 */
import type {
  CalendarRendererProps,
  CascaderRendererProps,
  CheckboxRendererProps,
  DateRendererProps,
  InputRendererProps,
  NumberRendererProps,
  PickerRendererProps,
  RadioRendererProps,
  RateRendererProps,
  SelectPickerRendererProps,
  SelectorRendererProps,
  SliderRendererProps,
  StepperRendererProps,
  SwitchRendererProps,
  TextAreaRendererProps,
  TextRendererProps,
  UploadRendererProps,
} from "../renderers"
import type { SchemxWithDictionary, Values } from "@schemx/core"

declare module "@schemx/core" {
  interface SchemxRendererDefinition<T extends Values> {
    input: InputRendererProps
    text: TextRendererProps
    textarea: TextAreaRendererProps
    number: NumberRendererProps
    switch: SwitchRendererProps
    radio: SchemxWithDictionary<RadioRendererProps, T>
    checkbox: SchemxWithDictionary<CheckboxRendererProps, T>
    date: DateRendererProps
    calendar: CalendarRendererProps
    picker: SchemxWithDictionary<PickerRendererProps, T>
    selector: SchemxWithDictionary<SelectorRendererProps, T>
    selectPicker: SchemxWithDictionary<SelectPickerRendererProps, T>
    rate: RateRendererProps
    slider: SliderRendererProps
    stepper: StepperRendererProps
    upload: UploadRendererProps
    cascader: CascaderRendererProps
  }
}
