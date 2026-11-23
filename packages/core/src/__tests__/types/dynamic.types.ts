import {
  createForm,
  type SchemxDynamicDependencies,
  type SchemxDynamicField,
  type SchemxDynamicItemSchema,
  type SchemxFormApi,
} from "../../index"

interface User {
  name: string
  idCard?: string
}

interface FormValues {
  settings: {
    country: string
  }
  users: User[]
}

const form = createForm<FormValues>()

const dynamicDependencies: SchemxDynamicDependencies<FormValues> = {
  triggerFields: ["settings.country"],
  visible: (values) => values.settings.country === "CN",
}

const itemDependency: SchemxDynamicItemSchema<User, FormValues> = {
  key: "country-dependent",
  to: ["settings.country"],
  renderer: (values, formApi, context) => {
    const country: string = values.settings.country

    const rowName: string = context.item.name

    const rowIndex: number = context.rowIndex

    const typedFormApi: SchemxFormApi<FormValues> = formApi

    void country
    void rowName
    void rowIndex
    void typedFormApi

    return [{ name: "idCard", label: "证件号", componentType: "input" }]
  },
}

const dynamicSchema: SchemxDynamicField<FormValues, User> = {
  key: "users-schema",
  name: "users",
  dependencies: dynamicDependencies,
  item: [itemDependency],
}

// @ts-expect-error Dynamic Item Dependency 的 to 必须是完整表单路径。
const invalidRelativeDependency: SchemxDynamicItemSchema<User, FormValues> = {
  key: "invalid-relative-dependency",
  to: ["not-a-form-path"],
  renderer: () => [],
}

const invalidNestedDynamic: SchemxDynamicField<FormValues, User> = {
  key: "invalid-nested-dynamic",
  name: "users",
  item: [
    {
      key: "nested-dynamic",
      // @ts-expect-error Dynamic Item 不允许嵌套 Dynamic Schema。
      name: "users",
      item: [],
    },
  ],
}

void dynamicSchema
void invalidRelativeDependency
void invalidNestedDynamic
form.destroy()

// 字典读取完整表单快照，字段名仍使用当前行的相对路径。
const rowDictionary: SchemxDynamicItemSchema<User, FormValues> = {
  name: "idCard",
  label: "证件类型",
  componentType: "select",
  dict: {
    dependsOn: ["settings.country"],
    api: (values) => {
      // @ts-expect-error 行字段不在表单根上。
      void values.idCard

      return [values.settings.country]
    },
  },
  dependencies: {
    triggerFields: ["idCard"],
    dict: (values) => (values.settings.country === "CN" ? undefined : false),
  },
}

void rowDictionary
