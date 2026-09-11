import type { SchemxConfig, SchemxRendererPropsMap } from "../../index"

const rendererProps: SchemxRendererPropsMap = {
  custom: {
    disabled: true,
    placeholder: "请输入",
  },
}

const config: SchemxConfig = { rendererProps }

const invalidValue: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error value 由 Runtime 注入，不能配置为 Renderer 默认值。
    value: "默认值",
  },
}

const invalidValueUpdate: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error onUpdate:value 由 Runtime 注入，不能配置为 Renderer 默认值。
    "onUpdate:value": () => {},
  },
}

const invalidFormInstance: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error formInstance 由 Runtime 注入，不能配置为 Renderer 默认值。
    formInstance: undefined,
  },
}

const invalidFormItemProps: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error formItemProps 由 Runtime 注入，不能配置为 Renderer 默认值。
    formItemProps: undefined,
  },
}

void config
void invalidValue
void invalidValueUpdate
void invalidFormInstance
void invalidFormItemProps
