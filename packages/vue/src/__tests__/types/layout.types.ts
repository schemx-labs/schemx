import { defineComponent } from "vue"

import type {
  ConfigProviderProps,
  SchemxColComponent,
  SchemxColProps,
  SchemxFormProps,
  SchemxInstallOptions,
  SchemxVueConfig,
} from "../../index"

const TestCol = defineComponent({})

const colComponent: SchemxColComponent = TestCol

const colProps: SchemxColProps = {
  component: colComponent,
  layout: { span: 12, offset: 1, block: true },
}

const formProps: SchemxFormProps = {
  colComponent,
}

const providerProps: ConfigProviderProps = {
  colComponent,
}

const vueConfig: SchemxVueConfig = {
  colComponent,
}

const installOptions: SchemxInstallOptions = {
  colComponent,
}

void colProps
void formProps
void providerProps
void vueConfig
void installOptions
