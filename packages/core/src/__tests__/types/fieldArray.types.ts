import {
  createForm,
  type FieldArrayItemValue,
  type FieldArrayPath,
  type SetValueAction,
  type SetValuesAction,
} from "../../index"

interface Values {
  name: string
  profile: {
    city: string
  }
  users: Array<{ name: string }>
  tags: string[]
  tuple: [string, string]
}

const form = createForm<Values>()

form.setFieldValue("name", (previous) => {
  const value: string | undefined = previous

  return value ?? ""
})

form.setFieldValue("profile.city", (previous) => {
  const value: string | undefined = previous

  return value ?? ""
})

form.setFieldValue("users", (previous) => {
  const users: Values["users"] | undefined = previous

  return [...(users ?? []), { name: "Ada" }]
})

const usersPath: FieldArrayPath<Values> = "users"

const tagsPath: FieldArrayPath<Values> = "tags"

const user: FieldArrayItemValue<Values["users"]> = { name: "Grace" }

const updater: SetValueAction<Values, "users"> = (previous) => previous ?? []

const valuesUpdater: SetValuesAction<Values> = (previousValues) => ({
  name: previousValues.name,
})

form.setInitialValue("name", (previous) => previous ?? "")
form.setFieldsValue((previousValues) => ({ name: previousValues.name }))
form.setInitialValues((previousValues) => ({ name: previousValues.name }))

// @ts-expect-error updater 必须返回 users 数组值。
form.setFieldValue("users", () => "invalid")

// @ts-expect-error 批量 updater 必须返回部分表单值。
form.setFieldsValue(() => ({ name: 1 }))

// @ts-expect-error tuple 不是可动态重排的数组路径。
const tuplePath: FieldArrayPath<Values> = "tuple"

// @ts-expect-error 旧 FieldArray API 不再存在。
form.getOrCreateFieldArray("users")

void usersPath
void tagsPath
void user
void updater
void valuesUpdater
void tuplePath
form.destroy()
