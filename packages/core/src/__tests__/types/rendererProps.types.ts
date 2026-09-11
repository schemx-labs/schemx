import type { SchemxConfig, SchemxRendererPropsMap } from "../../index"

const rendererProps: SchemxRendererPropsMap = {
  custom: {
    disabled: true,
    placeholder: "请输入",
  },
}

const config: SchemxConfig = { rendererProps }

void config
