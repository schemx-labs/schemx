/**
 * createField 单元测试
 *
 * 验证 createField 工厂函数根据字段路径推导类型的能力，
 * 以及 setValue/getValue 对表单字段值的双向绑定。
 *
 * @module core/__tests__/createField
 */
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test"

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
  it("字段操作继续通过公开 Form 方法分发，保留原有拦截点", async () => {
    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    const field = createField(form, "name")

    expect(createField(form, "name").ref).toBe(field.ref)

    const validate = vi.spyOn(form, "validateField")

    const change = vi.spyOn(form, "changeField")

    const blur = vi.spyOn(form, "blurField")

    await field.validate()
    await field.change("Grace")
    await field.blur()
    expect(validate).toHaveBeenCalledWith("name")
    expect(change).toHaveBeenCalledExactlyOnceWith("name", "Grace")
    expect(blur).toHaveBeenCalledExactlyOnceWith("name")
    form.destroy()
  })

  it("轻量工具复用 Form 绑定，读取与写入经过传入的扩展实例", async () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "person", name: "name", label: "姓名", componentType: "input" }],
    })

    const native = createField(form, "name")

    const extended = { ...form }

    const read = vi.spyOn(extended, "getFieldValue")

    const write = vi.spyOn(extended, "setFieldValue")

    const change = vi.spyOn(extended, "changeField")

    const field = createField(extended, "name")

    expect(field).not.toBe(native)
    expect(createField(extended, "name").ref).toBe(field.ref)
    expect(field.state).toBe(native.state)
    expect(field.getValue()).toBe("Ada")
    expect(read).toHaveBeenCalledExactlyOnceWith("name")
    form.setSchemas([
      { key: "person", name: "nickname", label: "昵称", componentType: "input" },
    ])
    field.setValue("next")
    expect(write).toHaveBeenCalledWith("nickname", expect.any(Function))
    await field.change("changed")
    expect(change).toHaveBeenCalledExactlyOnceWith("nickname", "changed")
    expect(native.getValue()).toBe("changed")
    form.setSchemas([])
    field.setValue("stale")
    expect(write).toHaveBeenCalledTimes(1)
    expect(field.getValue()).toBeUndefined()
    form.destroy()
  })

  it("手动字段保持初始路径绑定，后挂载的 Schema 通过新调用取得节点绑定", () => {
    const form = createForm({ initialValues: { name: "Ada", nickname: "A" } })

    const manual = createField(form, "name")

    expect(createField(form, "name").ref).toBe(manual.ref)
    form.setSchemas([
      { key: "field", name: "name", label: "姓名", componentType: "input" },
    ])
    const field = createField(form, "name")

    expect(field.ref).not.toBe(manual.ref)
    expect(createField(form, "name").ref).toBe(field.ref)
    form.setSchemas([
      { key: "field", name: "nickname", label: "昵称", componentType: "input" },
    ])
    expect(createField(form, "nickname").ref).toBe(field.ref)
    expect(field.getValue()).toBe("A")
    expect(manual.getValue()).toBe("Ada")
    expect(manual.state.name.value).toBe("name")
    form.setSchemas([])
    expect(field.state.disposed.value).toBe(true)
    expect(manual.state.disposed.value).toBe(false)
    expect(createField(form, "name").ref).toBe(manual.ref)
    form.destroy()
    expect(manual.state.disposed.value).toBe(true)
    expect(manual.state.name.value).toBeUndefined()
    expect(manual.getValue()).toBeUndefined()
    expect(() => createField(form, "name")).toThrow("destroyed")
  })

  it("完整字段操作在改名后解析当前地址，删除后所有字段写操作停止", async () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "field", name: "name", label: "姓名", componentType: "input" }],
    })

    const field = createField(form, "name")

    const values: unknown[] = []

    const snapshots = vi.fn(() => field.getSnapshot())

    form.effect(snapshots)
    field.effect(() => values.push(field.getValue()))
    form.setSchemas([
      { key: "field", name: "nickname", label: "昵称", componentType: "input" },
    ])
    expect(field.getInitialValue()).toBe("A")
    field.setInitialValue("baseline")
    field.setValue("next")
    expect(field.getSnapshot()).toBe("next")
    expect(form.getInitialValue("nickname")).toBe("baseline")
    expect(form.getInitialValue("name")).toBe("Ada")
    field.setErrors(["错误"])
    expect(field.getErrors()).toEqual(["错误"])
    expect(form.getFieldErrors("name")).toEqual([])
    field.clearErrors()
    field.setTouched(true)
    field.setPending(true, "处理中")
    expect(field.isTouched()).toBe(true)
    expect(field.isPending()).toBe(true)
    expect(form.getPendingFields()).toEqual([{ field: "nickname", message: ["处理中"] }])
    field.reset()
    expect(field.getValue()).toBe("baseline")
    expect(field.isTouched()).toBe(false)
    expect(field.isPending()).toBe(false)
    expect(values).toEqual(["Ada", "A", "next", "baseline"])
    expect(snapshots).toHaveBeenCalledTimes(1)
    form.setSchemas([])
    const before = form.getFieldsSnapshot()

    field.setValue("stale")
    field.setInitialValue("stale")
    field.setErrors(["stale"])
    field.clearErrors()
    field.setTouched(true)
    field.setPending(true)
    field.setRules({ required: true })
    field.removeRules()
    field.reset()
    expect(field.getInitialValue()).toBeUndefined()
    expect(field.getSnapshot()).toBeUndefined()
    expect(field.getErrors()).toEqual([])
    expect(field.isTouched()).toBe(false)
    expect(field.isPending()).toBe(false)
    expect(form.getFieldsSnapshot()).toEqual(before)
    expect(form.getInitialValue("nickname")).toBe("baseline")
    expect(values).toEqual(["Ada", "A", "next", "baseline"])
    await expect(field.validate()).resolves.toMatchObject({ cancelled: true })
    await expect(field.change("stale")).resolves.toBeUndefined()
    const late = vi.fn()

    field.effect(late)
    expect(late).not.toHaveBeenCalled()
    form.destroy()
  })

  it("setRules 暂按调用时的当前路径转发，不迁移已有规则", async () => {
    const form = createForm({
      initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
      schemas: [
        {
          key: "users",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    const first = createField(form, "users.0.name")

    const second = createField(form, "users.1.name")

    first.setRules({
      validate: () => ({ valid: false, issues: [{ message: "路径错误" }] }),
    })
    await expect(first.validate()).resolves.toMatchObject({ valid: false })
    form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
    expect(createField(form, "users.1.name").ref).toBe(first.ref)
    await expect(first.validate()).resolves.toMatchObject({ valid: true })
    await expect(second.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "users.0.name" }],
    })
    second.removeRules()
    await expect(second.validate()).resolves.toMatchObject({ valid: true })
    form.destroy()
  })

  it("空实例规则撤销 Schema 和默认规则，撤销覆盖后恢复 Schema 规则", async () => {
    const form = createForm({
      initialValues: { name: "x" },
      fieldRules: { name: { min: 2, message: "默认错误" } },
      schemas: [
        {
          key: "field",
          name: "name",
          label: "姓名",
          componentType: "input",
          rules: { min: 2, message: "Schema 错误" },
        },
      ],
    })

    const field = createField(form, "name")

    field.setRules([])
    await expect(field.validate()).resolves.toMatchObject({ valid: true })
    form.setConfig({ schemaConfig: { labelWidth: 120 } })
    await expect(field.validate()).resolves.toMatchObject({ valid: true })
    field.removeRules()
    await expect(field.validate()).resolves.toMatchObject({ valid: false })
    expect(field.getErrors()).toEqual(["Schema 错误"])
    form.setSchemas([])
    form.setSchemas([
      {
        key: "field",
        name: "name",
        label: "姓名",
        componentType: "input",
        rules: { min: 2, message: "新规则" },
      },
    ])
    const replacement = createField(form, "name")

    expect(replacement.ref).not.toBe(field.ref)
    field.setRules([])
    await expect(replacement.validate()).resolves.toMatchObject({ valid: false })
    expect(replacement.getErrors()).toEqual(["新规则"])
    form.destroy()
  })

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
