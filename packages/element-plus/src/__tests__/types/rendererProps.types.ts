import { createRendererRegistry } from "@schemx/core"

import SchemxForm, { useForm } from "../../index"

import type {
  CreateFormOptions,
  SchemxField,
  SchemxFormItemProps,
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

// 字典从已声明的组件选项属性与表单值推导。
const createFormOptions: CreateFormOptions<FormValues> = {
  schemas: [
    {
      name: "city",
      label: "城市",
      componentType: "select",
      dict: {
        api(values) {
          // @ts-expect-error 字典回调保留 FormValues。
          void values.unknownField

          return [{ label: values.province, value: values.province }]
        },
        dependsOn: ["province"],
      },
    },
  ],
}

const formProps: SchemxFormProps<FormValues> = {
  schemas: [
    {
      name: "city",
      label: "城市",
      componentType: "select",
      // values 来自本次表单。
      dict: (values) => [{ label: values.name, value: values.name }],
    },
  ],
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

// 公共 Field Props 解开类型循环后仍保留组件 key 与动态组件 Props 约束。
const fieldProps: SchemxFormItemProps<FormValues> = {
  name: "city",
  label: "城市",
  componentType: "select",
  dependencies: {
    triggerFields: ["province"],
    componentProps: () => ({ multiple: true }),
  },
}

// @ts-expect-error 不能因公共 Props 推导而放宽为任意组件名。
fieldProps.componentType = "unknownRenderer"

void fieldProps

// 使用普通 Props 声明测试精确的数组元素与受控属性排除。
declare module "@schemx/core" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxRendererDefinition<TValues extends import("@schemx/core").Values> {
    typedChoice: {
      options?: readonly { id: number }[]
      columns?: { text: string }[]
      value?: string[]
    }
  }
}

// 已知目标可推导请求、动态字典和结果回调。
const typedSchemas: SchemxField<FormValues>[] = [
  {
    name: "city",
    label: "城市",
    componentType: "typedChoice",
    dict: {
      targetKey: "columns",
      api: (values) => [{ text: values.province }],
      onSuccess: (options) => options[0].text.trim(),
    },
    dependencies: {
      triggerFields: ["province"],
      dict: (values) => (values.province ? { api: () => [{ id: 1 }] } : false),
    },
  },
  {
    name: "city",
    label: "城市",
    componentType: "typedChoice",
    dict: {
      api: () => ({ list: [{ id: 1 }] }),
      formatter: (response) => {
        // @ts-expect-error 接口原始响应需要先收窄。
        void response.list

        return [{ id: 1 }]
      },
    },
  },
]

void typedSchemas

type Choice = Extract<SchemxField<FormValues>, { componentType: "typedChoice" }>
type Input = Extract<SchemxField<FormValues>, { componentType: "input" }>

// @ts-expect-error 默认目标要求 id 为数字。
const invalidOptions: Choice["dict"] = { api: () => [{ id: "wrong" }] }

// @ts-expect-error value 是受控属性。
const invalidTarget: Choice["dict"] = { targetKey: "value", api: () => [] }

// @ts-expect-error 依赖字段必须来自 FormValues。
const invalidPath: Choice["dict"] = { api: () => [], dependsOn: ["unknownField"] }

// @ts-expect-error input 不声明合法数组目标。
const invalidInputDict: Input["dict"] = { api: () => [] }

// @ts-expect-error 字典已移至字段顶层。
const legacyProps: Choice["componentProps"] = { dict: { api: () => [] } }

// Renderer 默认目标必须接收字段省略 targetKey 时推导出的选项。
const choiceRegistry = createRendererRegistry<FormValues>()

choiceRegistry.registerAll({
  typedChoice: { component: {}, dictionary: true },
  input: {},
})

choiceRegistry.register("typedChoice", {
  component: {},
  dictionary: { targetKey: "options" },
})

// @ts-expect-error columns 与默认的 options 选项类型不同，应在字段上显式指定。
choiceRegistry.register("typedChoice", {
  component: {},
  dictionary: { targetKey: "columns" },
})

// @ts-expect-error formatter 应返回该目标的数组元素。
const invalidFormat: Choice["dict"] = {
  api: () => [],
  formatter: () => [{ id: "wrong" }],
}

void invalidOptions
void invalidTarget
void invalidPath
void invalidInputDict
void legacyProps
void invalidFormat
