/**
 * createField 单元测试
 *
 * 验证 createField 工厂函数根据字段路径推导类型的能力，
 * 以及 setValue/getValue 对表单字段值的双向绑定。
 *
 * @module core/__tests__/createField
 */
import { describe, expect, expectTypeOf, it } from "vite-plus/test"

import { createField } from "../createField"
import { createForm } from "../createForm"

interface TypedForm {
  name: string
  age: number
  user: {
    city: string
  }
}

// createField 测试：验证字段类型推导和 setValue/getValue 双向绑定
describe("createField", () => {
  it("根据字段路径推导字段值类型", () => {
    const form = createForm<TypedForm>({
      initialValues: {
        name: "John",
        age: 20,
        user: {
          city: "Beijing",
        },
      },
    })

    const nameField = createField(form, "name")

    const ageField = createField(form, "age")

    const cityField = createField(form, "user.city")

    expectTypeOf(nameField.getValue()).toEqualTypeOf<string | undefined>()
    expectTypeOf(ageField.getValue()).toEqualTypeOf<number | undefined>()
    expectTypeOf(cityField.getValue()).toEqualTypeOf<string | undefined>()

    nameField.setValue("Jane")
    ageField.setValue(30)
    cityField.setValue("Shanghai")

    expect(form.getFieldValue("name")).toBe("Jane")
    expect(form.getFieldValue("age")).toBe(30)
    expect(form.getFieldValue("user.city")).toBe("Shanghai")

    const assertTypeOnly = (): void => {
      // @ts-expect-error name 字段只接受 string 或 undefined。
      nameField.setValue(123)
      // @ts-expect-error age 字段只接受 number 或 undefined。
      ageField.setValue("30")
    }

    void assertTypeOnly
  })

  it("getValues 返回可独立修改的表单值副本", () => {
    // 同时覆盖顶层属性和嵌套对象的隔离。
    const form = createForm<TypedForm>({
      initialValues: {
        name: "John",
        age: 20,
        user: { city: "Beijing" },
      },
    })

    // 字段实例读取的全表值应保留原表单类型。
    const field = createField(form, "name")

    // 修改读取结果无需通过类型断言绕过只读约束。
    const values = field.getValues()

    expectTypeOf(values).toEqualTypeOf<TypedForm>()
    values.name = "Jane"
    values.user.city = "Shanghai"

    expect(form.getFieldsValue()).toEqual({
      name: "John",
      age: 20,
      user: { city: "Beijing" },
    })
    form.destroy()
  })

  it("暴露字段错误 API", () => {
    const form = createForm<TypedForm>({
      initialValues: {
        name: "",
        age: 20,
        user: { city: "Beijing" },
      },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    const field = createField(form, "name")

    field.setErrors(["错误"])
    expect(field.getErrors()).toEqual(["错误"])
    field.clearErrors()
    expect(field.getErrors()).toEqual([])

    form.destroy()
  })

  it("未设置运行时覆盖时 removeRules 保留 Schema 规则", async () => {
    const form = createForm<TypedForm>({
      initialValues: {
        name: "",
        age: 20,
        user: { city: "Beijing" },
      },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
    })

    const field = createField(form, "name")

    field.removeRules()

    await expect(field.validate()).resolves.toEqual({
      valid: false,
      values: { name: "", age: 20, user: { city: "Beijing" } },
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ type: "validation", message: "姓名为必填项", code: "required" }],
        },
      ],
    })
    form.destroy()
  })
})
