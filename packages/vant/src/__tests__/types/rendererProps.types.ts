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
}

const rendererProps: SchemxRendererPropsMap<FormValues> = {
  input: {
    clearable: true,
    maxlength: 100,
  },
  picker: {
    columns: [],
    showToolbar: false,
  },
}

const invalidInputProps: SchemxRendererPropsMap<FormValues> = {
  input: {
    // @ts-expect-error input Renderer 不接受 picker 专属的 columns Props。
    columns: [],
  },
}

const invalidInputPropType: SchemxRendererPropsMap<FormValues> = {
  input: {
    // @ts-expect-error input Renderer 的 maxlength 不接受 boolean。
    maxlength: false,
  },
}

// 字典从已声明的组件选项属性与表单值推导。
const createFormOptions: CreateFormOptions<FormValues> = {
  schemas: [
    {
      name: "province",
      label: "城市",
      componentType: "picker",
      dict: {
        api(values) {
          // @ts-expect-error 字典回调保留 FormValues。
          void values.unknownField

          return [{ text: values.province, value: values.province }]
        },
        dependsOn: ["province"],
      },
    },
  ],
}

const formProps: SchemxFormProps<FormValues> = {
  schemas: [
    {
      name: "province",
      label: "城市",
      componentType: "picker",
      // values 来自本次表单。
      dict: (values) => [{ text: values.name, value: values.name }],
    },
  ],
}

void rendererProps
void invalidInputProps
void invalidInputPropType
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
