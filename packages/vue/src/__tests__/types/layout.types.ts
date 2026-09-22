import { defineComponent } from "vue"

import type {
  ConfigProviderProps,
  SchemxColComponent,
  SchemxColConfig,
  SchemxColDefinition,
  SchemxColProps,
  SchemxConfig,
  SchemxFormProps,
  SchemxGutter,
  SchemxInstallOptions,
  SchemxRowComponent,
  SchemxRowConfig,
  SchemxRowDefinition,
  SchemxRowProps,
  SchemxSchemaConfig,
} from "../../index"

const TestCol = defineComponent({})

const colComponent: SchemxColComponent = TestCol

const rowComponent: SchemxRowComponent = TestCol

const colConfig: SchemxColConfig = { span: 12, offset: 1, block: true }

const colDefinition: SchemxColDefinition = colConfig

const rowConfig: SchemxRowConfig = { gutter: 8, justify: "center" }

const rowDefinition: SchemxRowDefinition = rowConfig

const gutterValues: SchemxGutter[] = [8, [4, 8], [1, 2, 3, 4]]

const schemaConfig: SchemxSchemaConfig = { row: rowConfig }

const colProps: SchemxColProps = {
  col: colConfig,
}

const rowProps: SchemxRowProps = {
  row: rowConfig,
}

const formProps: SchemxFormProps = {
  colComponent,
  col: colConfig,
  row: rowConfig,
  rowComponent,
}

const providerProps: ConfigProviderProps = {
  colComponent,
  row: rowConfig,
  rowComponent,
}

const vueConfig: SchemxConfig = {
  colComponent,
  row: rowConfig,
  rowComponent,
}

const installOptions: SchemxInstallOptions = {
  colComponent,
  row: rowConfig,
  rowComponent,
}

void colProps
void colConfig
void colDefinition
void rowProps
void rowConfig
void rowDefinition
void gutterValues
void schemaConfig
void formProps
void providerProps
void vueConfig
void installOptions
