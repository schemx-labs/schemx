/**
 * Element Plus Renderer 的 Schemx 类型声明合并。
 *
 * 该模块通过入口副作用将 componentType 与 componentProps 关联到 Core 类型系统。
 */

import type {
  AutocompleteRendererProps,
  CascaderRendererProps,
  CheckboxRendererProps,
  ColorPickerRendererProps,
  DatePickerRendererProps,
  DateTimePickerRendererProps,
  InputNumberRendererProps,
  InputOtpRendererProps,
  InputRendererProps,
  InputTagRendererProps,
  MentionRendererProps,
  RadioRendererProps,
  RateRendererProps,
  SelectRendererProps,
  SensitiveInputRendererProps,
  SliderRendererProps,
  SwitchRendererProps,
  TimePickerRendererProps,
  TimeSelectRendererProps,
  TreeSelectRendererProps,
  UploadRendererProps,
  VirtualizedSelectRendererProps,
} from "../renderers"
import type { Values } from "@schemx/core"
import type { SchemxWithDictionary } from "@schemx/vue"
import type { ColProps, RowProps } from "element-plus"

declare module "@schemx/core" {
  interface SchemxRendererDefinition<TValues extends Values> {
    input: InputRendererProps
    inputNumber: InputNumberRendererProps
    switch: SwitchRendererProps
    radio: SchemxWithDictionary<RadioRendererProps, TValues>
    checkbox: SchemxWithDictionary<CheckboxRendererProps, TValues>
    datePicker: DatePickerRendererProps
    cascader: SchemxWithDictionary<CascaderRendererProps, TValues>
    sensitiveInput: SensitiveInputRendererProps
    rate: RateRendererProps
    slider: SliderRendererProps
    upload: UploadRendererProps
    autocomplete: SchemxWithDictionary<AutocompleteRendererProps, TValues>
    colorPicker: ColorPickerRendererProps
    datetimePicker: DateTimePickerRendererProps
    inputTag: InputTagRendererProps
    inputOtp: InputOtpRendererProps
    mention: SchemxWithDictionary<MentionRendererProps, TValues>
    select: SchemxWithDictionary<SelectRendererProps, TValues>
    virtualizedSelect: SchemxWithDictionary<VirtualizedSelectRendererProps, TValues>
    timePicker: TimePickerRendererProps
    timeSelect: TimeSelectRendererProps
    treeSelect: SchemxWithDictionary<TreeSelectRendererProps, TValues>
  }
}

declare module "@schemx/vue" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxColDefinition<TValues extends Values = Values> extends ColProps {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRowDefinition<TValues extends Values = Values> extends Omit<
    RowProps,
    "gutter"
  > {}
}
