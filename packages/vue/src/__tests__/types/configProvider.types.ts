import type { ConfigProviderProps } from "../../index"

interface FormValues {
  name: string
}

const providerProps: ConfigProviderProps<FormValues> = {
  schemaConfig: {
    readonly: true,
    labelAlign: "left",
  },
  rendererProps: {
    input: {
      placeholder: "请输入姓名",
    },
  },
  validatorAdapters: [],
  defaultRendererType: "input",
}

// @ts-expect-error ConfigProvider 不接受额外的 config 包装层。
const invalidProviderProps: ConfigProviderProps = { config: {} }

void providerProps
void invalidProviderProps
