import { defineComponent } from "vue"

import type {
  ConfigProviderProps,
  SchemxConfig,
  SchemxField,
  SchemxFormProps,
  SchemxIconComponent,
  SchemxIconProps,
  SchemxIconValue,
  SchemxInstallOptions,
} from "../../index"

interface FormValues {
  name: string
}

const TestIcon = defineComponent({})

const iconComponent: SchemxIconComponent = TestIcon

const iconValue: SchemxIconValue = TestIcon

const iconName: SchemxIconValue = "info"

const iconProps: SchemxIconProps = {
  icon: iconName,
  component: iconComponent,
}

const field: SchemxField<FormValues> = {
  name: "name",
  label: "姓名",
  componentType: "input",
  labelIcon: TestIcon,
}

const formProps: SchemxFormProps<FormValues> = {
  iconComponent,
  schemas: [field],
}

const providerProps: ConfigProviderProps<FormValues> = { iconComponent }

const config: SchemxConfig = { iconComponent }

const installOptions: SchemxInstallOptions = { iconComponent }

// @ts-expect-error 图标值不接受数字。
const invalidIconValue: SchemxIconValue = 1

void iconValue
void iconProps
void formProps
void providerProps
void config
void installOptions
void invalidIconValue
