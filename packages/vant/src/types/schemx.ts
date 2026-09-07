/**
 * schemx 渲染器类型声明合并
 *
 * 将 Vant 渲染器的 componentType 和 componentProps 注册到 schemx 类型系统，
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
  SelectorRendererProps,
  SelectPickerRendererProps,
  SensitiveInputRendererProps,
  SliderRendererProps,
  StepperRendererProps,
  SwitchRendererProps,
  TextAreaRendererProps,
  TextRendererProps,
  UploadRendererProps,
} from "../renderers"
import type { Values } from "@schemx/core"
import type { SchemxWithDictionary } from "@schemx/vue"

declare module "@schemx/core" {
  interface SchemxRendererDefinition<TValues extends Values> {
    input: InputRendererProps
    text: TextRendererProps
    textarea: TextAreaRendererProps
    number: NumberRendererProps
    switch: SwitchRendererProps
    radio: SchemxWithDictionary<RadioRendererProps, TValues>
    checkbox: SchemxWithDictionary<CheckboxRendererProps, TValues>
    date: DateRendererProps
    calendar: CalendarRendererProps
    picker: SchemxWithDictionary<PickerRendererProps, TValues>
    selectPicker: SchemxWithDictionary<SelectPickerRendererProps, TValues>
    selector: SchemxWithDictionary<SelectorRendererProps, TValues>
    sensitiveInput: SensitiveInputRendererProps
    rate: RateRendererProps
    slider: SliderRendererProps
    stepper: StepperRendererProps
    upload: UploadRendererProps
    cascader: SchemxWithDictionary<CascaderRendererProps>
  }
}
