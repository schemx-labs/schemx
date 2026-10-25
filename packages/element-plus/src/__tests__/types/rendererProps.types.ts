import SchemxForm, { useForm } from "../../index"

import type {
  CreateFormOptions,
  SchemxFormProps,
  SchemxRendererPropsMap,
} from "../../index"
import type { SchemxFormPlugin, SchemxInstance } from "@schemx/vue"

interface FormValues {
  name: string
  province: string
  city: string
  tags: string[]
  otp: string
  appointments: string
}

const rendererProps: SchemxRendererPropsMap<FormValues> = {
  input: {
    clearable: true,
    maxlength: 100,
  },
  inputNumber: {
    min: 0,
    precision: 0,
  },
  cascader: {
    options: [],
  },
  autocomplete: {
    options: [{ label: "Ada", value: "ada" }],
    onSelect: (item) => item.value,
  },
  colorPicker: {
    onClear: () => undefined,
  },
  datetimePicker: {
    type: "datetime",
  },
  inputTag: {
    onAddTag: (value) => value,
  },
  inputOtp: {
    length: 6,
    onFinish: (value) => value,
  },
  mention: {
    options: [{ label: "Ada", value: "ada" }],
    onSearch: (pattern, prefix) => `${prefix}${pattern}`,
  },
  select: {
    options: [{ label: "A", value: "a" }],
    multiple: true,
    onRemoveTag: (value) => value,
  },
  virtualizedSelect: {
    options: [{ label: "A", value: "a" }],
    height: 300,
  },
  timePicker: {
    isRange: true,
    format: "HH:mm:ss",
  },
  timeSelect: {
    start: "08:00",
    end: "18:00",
    step: "00:30",
  },
  treeSelect: {
    options: [{ label: "A", value: "a" }],
    props: { label: "label", children: "children" },
    nodeKey: "value",
    valueKey: "value",
    onCheck: (data) => data,
  },
}

const invalidInputProps: SchemxRendererPropsMap<FormValues> = {
  input: {
    // @ts-expect-error input Renderer 不接受 Cascader 专属的 options Props。
    options: [],
  },
}

const invalidInputPropType: SchemxRendererPropsMap<FormValues> = {
  input: {
    // @ts-expect-error input Renderer 的 maxlength 不接受 boolean。
    maxlength: false,
  },
}

const invalidRendererNames: SchemxRendererPropsMap<FormValues> = {
  // @ts-expect-error Renderer key 使用 inputOtp，而不是 inputOTP。
  inputOTP: {
    length: 6,
  },
}

const invalidVirtualizedRendererName: SchemxRendererPropsMap<FormValues> = {
  // @ts-expect-error Renderer key 使用 virtualizedSelect，而不是 selectV2。
  selectV2: {
    options: [],
  },
}

const removedRendererProps: SchemxRendererPropsMap<FormValues> = {
  // @ts-expect-error Element Plus 适配包不再支持 picker Renderer。
  picker: {
    options: [],
  },
}

const createFormOptions: CreateFormOptions<FormValues> = {
  rendererProps: {
    cascader: {
      dict: {
        api(values) {
          const province: string = values.province

          // @ts-expect-error CreateFormOptions 应保留 FormValues，不存在 unknownField。
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          values.unknownField

          return [{ label: province, value: province }]
        },
      },
    },
  },
}

const formProps: SchemxFormProps<FormValues> = {
  rendererProps: {
    radio: {
      dict: {
        api(values) {
          const name: string = values.name

          // @ts-expect-error SchemxFormProps 应保留 FormValues，不存在 unknownField。
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          values.unknownField

          return [{ label: name, value: name }]
        },
      },
    },
  },
}

void rendererProps
void invalidInputProps
void invalidInputPropType
void invalidRendererNames
void invalidVirtualizedRendererName
void removedRendererProps
void createFormOptions
void formProps

// 包装入口的最小表单值类型。
interface UiFormValues {
  name: string
}

// UI 包装入口保留 Vue Form 的泛型调用契约。
const uiPlugin: SchemxFormPlugin = SchemxForm

SchemxForm<UiFormValues>({
  initialValues: { name: "" },
  onFinish: (values) => {
    values.name.trim()
    // @ts-expect-error 未声明的字段不能出现在包装组件的回调中。
    void values.unknownField
  },
})

const uiForm: SchemxInstance<UiFormValues> = useForm<UiFormValues>({
  initialValues: { name: "" },
  schemaConfig: {
    required: {
      isEmpty: (value) => {
        // @ts-expect-error 默认值回调保留字段值类型。
        return value.unknownField
      },
    },
  },
})

// @ts-expect-error UI Hook 也只接受一个配置参数。
useForm<UiFormValues>({}, {})

void uiPlugin
void uiForm
