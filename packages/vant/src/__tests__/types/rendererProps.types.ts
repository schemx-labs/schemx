import type {
  CreateFormOptions,
  SchemxFormProps,
  SchemxRendererPropsMap,
} from "../../index"

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

const createFormOptions: CreateFormOptions<FormValues> = {
  rendererProps: {
    picker: {
      dict: {
        api(values) {
          const province: string = values.province

          // @ts-expect-error CreateFormOptions 应保留 FormValues，不存在 unknownField。
          values.unknownField

          return [province]
        },
      },
    },
  },
}

const formProps: SchemxFormProps<FormValues> = {
  rendererProps: {
    picker: {
      dict: {
        api(values) {
          const name: string = values.name

          // @ts-expect-error SchemxFormProps 应保留 FormValues，不存在 unknownField。
          values.unknownField

          return [name]
        },
      },
    },
  },
}

void rendererProps
void invalidInputProps
void invalidInputPropType
void createFormOptions
void formProps
