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
import type { ButtonProps, ColProps, RowProps } from "element-plus"

declare module "@schemx/core" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRendererDefinition<TValues extends Values> {
    input: InputRendererProps
    inputNumber: InputNumberRendererProps
    switch: SwitchRendererProps
    radio: RadioRendererProps
    checkbox: CheckboxRendererProps
    datePicker: DatePickerRendererProps
    cascader: CascaderRendererProps
    sensitiveInput: SensitiveInputRendererProps
    rate: RateRendererProps
    slider: SliderRendererProps
    upload: UploadRendererProps
    autocomplete: AutocompleteRendererProps
    colorPicker: ColorPickerRendererProps
    datetimePicker: DateTimePickerRendererProps
    inputTag: InputTagRendererProps
    inputOtp: InputOtpRendererProps
    mention: MentionRendererProps
    select: SelectRendererProps
    virtualizedSelect: VirtualizedSelectRendererProps
    timePicker: TimePickerRendererProps
    timeSelect: TimeSelectRendererProps
    treeSelect: TreeSelectRendererProps
  }
}

declare module "@schemx/vue" {
  interface SchemxButtonDefinition extends Partial<ButtonProps> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxColDefinition<TValues extends Values = Values> extends ColProps {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRowDefinition<TValues extends Values = Values> extends Omit<
    RowProps,
    "gutter"
  > {}
}
