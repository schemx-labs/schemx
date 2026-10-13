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
  Values,
} from "../../index"

const TestCol = defineComponent({})

const colComponent: SchemxColComponent = TestCol

const rowComponent: SchemxRowComponent = TestCol

const colConfig: SchemxColConfig = { span: 12, offset: 1, block: true }

const colDefinition: SchemxColDefinition = colConfig

const rowConfig: SchemxRowConfig = { gutter: 8, justify: "center" }

const rowDefinition: SchemxRowDefinition = rowConfig

const gutterValues: SchemxGutter[] = [8, [4, 8], [1, 2, 3, 4]]

const schemaConfig: SchemxConfig = { schemaConfig: { row: rowConfig } }

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
  schemaConfig: { row: rowConfig },
  rowComponent,
}

const vueConfig: SchemxConfig = {
  colComponent,
  schemaConfig: { row: rowConfig },
  rowComponent,
}

const installOptions: SchemxInstallOptions = {
  colComponent,
  schemaConfig: { row: rowConfig },
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

// 布局扩展回调必须保留嵌套配置的表单值类型。
declare module "../../types/layout" {
  interface SchemxColDefinition<TValues extends Values = Values> {
    configTypeTestSpan?: (values: TValues) => number
  }

  interface SchemxRowDefinition<TValues extends Values = Values> {
    configTypeTestGutter?: (values: TValues) => number
  }
}

const typedLayoutConfig: SchemxConfig<{ age: number }> = {
  schemaConfig: {
    col: {
      configTypeTestSpan: (values) => values.age,
    },
    layout: {
      configTypeTestSpan: (values) => {
        // @ts-expect-error age 是数值，不能按字符串处理。
        return values.age.trim()
      },
    },
    row: {
      configTypeTestGutter: (values) => {
        // @ts-expect-error 表单值中不存在 unknownField。
        return values.unknownField
      },
    },
  },
}

void typedLayoutConfig
