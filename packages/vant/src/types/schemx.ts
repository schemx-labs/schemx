/**
 * schemx 渲染器类型声明合并
 *
 * 将 Vant 渲染器的 componentType 和 componentProps 注册到 schemx 类型系统，
 * 使 schemas 配置获得完整的类型提示。
 */
import type { ButtonProps } from "vant"

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

declare module "@schemx/core" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRendererDefinition<TValues extends Values> {
    input: InputRendererProps
    text: TextRendererProps
    textarea: TextAreaRendererProps
    number: NumberRendererProps
    switch: SwitchRendererProps
    radio: RadioRendererProps
    checkbox: CheckboxRendererProps
    date: DateRendererProps
    calendar: CalendarRendererProps
    picker: PickerRendererProps
    selectPicker: SelectPickerRendererProps
    selector: SelectorRendererProps
    sensitiveInput: SensitiveInputRendererProps
    rate: RateRendererProps
    slider: SliderRendererProps
    stepper: StepperRendererProps
    upload: UploadRendererProps
    cascader: CascaderRendererProps
  }
}

declare module "@schemx/vue" {
  interface SchemxButtonDefinition extends Partial<ButtonProps> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxColDefinition<TValues extends Values = Values> {
    tag?: keyof HTMLElementTagNameMap
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRowDefinition<TValues extends Values = Values> {
    tag?: keyof HTMLElementTagNameMap
    wrap?: boolean
  }
}
