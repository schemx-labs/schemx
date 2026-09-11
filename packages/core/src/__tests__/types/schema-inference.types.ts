import { createForm, createSchemas } from "../../index"

import type {
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxField,
  SchemxGroupField,
  SchemxInstance,
  SchemxSchemas,
} from "../../index"

interface ContactCardValue {
  name: string
  phone: string
}

interface FormValues {
  contact: ContactCardValue
  note: string
  age: number
  users: Array<{
    name: string
    age: number
  }>
}

const schemas: SchemxField<FormValues>[] = [
  {
    name: "contact",
    label: "联系人",
    componentType: "contact-card",
    initialValue: {
      name: "Ada",
      phone: "123",
    },
    required: {
      isEmpty: (value) => {
        const contact: ContactCardValue | null | undefined = value

        return !contact?.phone
      },
    },
    onChange: (value) => {
      const contact: ContactCardValue | undefined = value

      void contact?.phone
    },
    rules: [
      {
        validate: (value) => {
          const contact: ContactCardValue | undefined = value

          return contact?.phone ? { valid: true } : { valid: false, issues: [] }
        },
      },
    ],
  },
  {
    name: "note",
    label: "备注",
    componentType: "input",
    rules: [
      {
        validate: (value) => {
          const note: string | undefined = value

          return note?.trim() ? { valid: true } : { valid: false, issues: [] }
        },
      },
    ],
  },
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    rules: [
      {
        validate: (value) => {
          const age: number | undefined = value

          // @ts-expect-error 数值字段不能调用字符串方法。
          value?.trim()

          return age !== undefined ? { valid: true } : { valid: false, issues: [] }
        },
      },
    ],
  },
]

const invalidInitialValue: SchemxField<FormValues>[] = [
  // @ts-expect-error contact 字段不能使用 number 初始值。
  {
    name: "contact",
    label: "联系人",
    componentType: "contact-card",
    initialValue: 1,
  },
]

const group: SchemxGroupField<FormValues> = {
  label: "联系人组",
  children: [
    {
      name: "contact",
      label: "联系人",
      componentType: "contact-card",
      rules: [{ validate: (value) => (value?.phone ? { valid: true } : { valid: false, issues: [] }) }],
    },
  ],
}

const dependency: SchemxDependencyField<FormValues> = {
  to: ["note"],
  renderer: () => [
    {
      name: "contact",
      label: "联系人",
      componentType: "contact-card",
      rules: [{ validate: (value) => (value?.phone ? { valid: true } : { valid: false, issues: [] }) }],
    },
  ],
}

const dynamic: SchemxDynamicField<FormValues, FormValues["users"][number]> = {
  key: "users",
  name: "users",
  item: [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      rules: [{ validate: (value) => (value?.trim() ? { valid: true } : { valid: false, issues: [] }) }],
    },
  ],
}

const explicitForm = createForm<FormValues>({ schemas })
const inferredFromInitialValues = createForm({
  initialValues: {
    contact: { name: "Ada", phone: "123" },
    note: "",
    age: 0,
    users: [],
  },
  schemas,
})
const inferredFromSchemas = createForm({ schemas })
const source: SchemxSchemas<FormValues> = createSchemas(schemas)
const inferredFromSource = createForm({ schemas: source })

const explicitInstance: SchemxInstance<FormValues> = explicitForm
const initialValuesInstance: SchemxInstance<FormValues> = inferredFromInitialValues
const schemasInstance: SchemxInstance<FormValues> = inferredFromSchemas
const sourceInstance: SchemxInstance<FormValues> = inferredFromSource

explicitInstance.setSchemas([group, dependency, dynamic])
explicitInstance.updateSchemas((previous) => [...previous, ...schemas])

void invalidInitialValue
void explicitInstance
void initialValuesInstance
void schemasInstance
void sourceInstance
