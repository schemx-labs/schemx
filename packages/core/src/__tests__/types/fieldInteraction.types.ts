import { createField, createForm } from "../../index"

import type { FieldValue, ValidationResult } from "../../index"

interface FormValues {
  name: string
  age: number
  profile: { active: boolean }
}

const form = createForm<FormValues>({
  initialValues: { name: "Ada", age: 20, profile: { active: true } },
  schemas: [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      onChange: (value, current) => {
        const name: FieldValue<FormValues> | undefined = value

        const age: number | undefined = current.getFieldValue("age")

        void name
        void age
      },
    },
  ],
})

const field = createField(form, "age")

const changed: Promise<ValidationResult<FormValues> | undefined> = field.change(21)

const blurred: Promise<ValidationResult<FormValues> | undefined> = field.blur()

const named: Promise<ValidationResult<FormValues, "name"> | undefined> = form.changeField(
  "name",
  undefined
)

const nested: Promise<ValidationResult<FormValues, "profile.active"> | undefined> =
  form.blurField("profile.active")

void changed
void blurred
void named
void nested
// @ts-expect-error 用户修改值必须匹配字段路径类型。
void field.change("21")
// @ts-expect-error 字段值不能退化为其他路径的值联合。
void form.changeField("name", 21)
// @ts-expect-error 用户交互只接受字段值，不接受 updater。
void form.changeField("age", (value: number) => value + 1)
// @ts-expect-error 交互入口不接受不存在的字段。
void form.blurField("missing")
// @ts-expect-error 框架不能逐次覆盖 Core 的触发策略。
void form.blurField("name", { validationTrigger: "change" })
