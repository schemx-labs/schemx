import { describe, expect, it } from "vitest"

import { createForm } from "../index"
import { createStore } from "../store/store"

interface FormValues {
  users: Array<{
    name: string
    age: number
  }>
}

interface NestedFieldArrayForm {
  profile: {
    items: FormValues["users"]
  }
}

function getUserNames(form: ReturnType<typeof createForm<FormValues>>): string[] {
  return form.getFieldsValue().users.map((user) => user.name)
}

describe("FieldArray", () => {
  it("注册空数组后仍能读取数组根值", () => {
    const form = createForm<FormValues>({ initialValues: { users: [] } })

    form.getOrCreateFieldArray("users")

    expect(form.getFieldsValue()).toEqual({ users: [] })

    form.destroy()
  })

  it("支持结构操作并保持行 key", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Alice", age: 18 },
          { name: "Bob", age: 20 },
        ],
      },
    })

    const fieldArray = form.getOrCreateFieldArray("users")

    const initial = fieldArray.getFields()

    expect(initial).toHaveLength(2)
    expect(getUserNames(form)).toEqual(["Alice", "Bob"])

    fieldArray.append({ name: "Carol", age: 22 })
    expect(getUserNames(form)).toEqual(["Alice", "Bob", "Carol"])
    expect(fieldArray.getFields()[0]?.key).toBe(initial[0]?.key)
    expect(fieldArray.getFields()[1]?.key).toBe(initial[1]?.key)

    fieldArray.insert(1, { name: "Dan", age: 24 })
    const inserted = fieldArray.getFields()

    expect(getUserNames(form)).toEqual(["Alice", "Dan", "Bob", "Carol"])
    expect(inserted[2]?.key).toBe(initial[1]?.key)

    fieldArray.move(3, 0)
    const moved = fieldArray.getFields()

    expect(getUserNames(form)).toEqual(["Carol", "Alice", "Dan", "Bob"])
    expect(moved[0]?.key).toBe(inserted[3]?.key)

    fieldArray.swap(0, 3)
    expect(getUserNames(form)).toEqual(["Bob", "Alice", "Dan", "Carol"])

    fieldArray.update(1, { name: "Alice Smith", age: 19 })
    expect(getUserNames(form)).toEqual(["Bob", "Alice Smith", "Dan", "Carol"])

    fieldArray.remove([0, 2])
    expect(getUserNames(form)).toEqual(["Alice Smith", "Carol"])
    expect(form.getFieldsValue()).toEqual({
      users: [
        { name: "Alice Smith", age: 19 },
        { name: "Carol", age: 22 },
      ],
    })

    form.destroy()
  })

  it("通过 Many 方法支持数组类型 Item", () => {
    interface MatrixValues {
      matrix: number[][]
    }

    const form = createForm<MatrixValues>({ initialValues: { matrix: [] } })

    const fieldArray = form.getOrCreateFieldArray("matrix")

    fieldArray.append([1, 2])
    expect(form.getFieldValue("matrix")).toEqual([[1, 2]])

    fieldArray.appendMany([
      [3, 4],
      [5, 6],
    ])
    expect(form.getFieldValue("matrix")).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ])

    form.destroy()
  })

  it("数组项字段保持细粒度响应式依赖", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Alice", age: 18 },
          { name: "Bob", age: 20 },
        ],
      },
    })

    const fieldArray = form.getOrCreateFieldArray("users")

    let firstNameRuns = 0

    let fieldsRuns = 0

    const disposeFirstName = form.effect(() => {
      firstNameRuns += 1
      form.getFieldValue("users.0.name")
    })

    const disposeFields = form.effect(() => {
      fieldsRuns += 1
      fieldArray.getFields()
    })

    expect(firstNameRuns).toBe(1)
    expect(fieldsRuns).toBe(1)

    form.setFieldValue("users.1.name", "Bob Smith")
    expect(firstNameRuns).toBe(1)
    expect(fieldsRuns).toBe(1)

    fieldArray.append({ name: "Carol", age: 22 })
    expect(firstNameRuns).toBe(1)
    expect(fieldsRuns).toBe(2)

    disposeFirstName()
    disposeFields()
    form.destroy()
  })

  it("结构变化清理受影响索引状态，规则按索引保留", async () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Alice", age: 18 },
          { name: "Bob", age: 20 },
        ],
      },
    })

    const fieldArray = form.getOrCreateFieldArray("users")

    form.setFieldTouched("users.0.name", true)
    form.setFieldPending("users.0.name", true, "保存中")
    form.setFieldErrors("users.0.name", ["名称无效"])
    form.setFieldRules("users.0.name", {
      validate: (value) =>
        value
          ? { valid: true }
          : { valid: false, issues: [{ message: "名称必填", code: "required" }] },
    })

    fieldArray.move(0, 1)

    expect(form.isFieldTouched("users.0.name")).toBe(false)
    expect(form.isFieldPending("users.0.name")).toBe(false)
    expect(form.getFieldErrors("users.0.name")).toEqual([])
    expect(form.getFieldErrors("users.1.name")).toEqual([])

    form.setFieldValue("users.0.name", "")
    await expect(form.validateField("users.0.name")).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "users.0.name" }],
    })

    fieldArray.remove(1)

    expect(form.getFieldErrors("users.0.name")).toEqual(["名称必填"])
    expect(form.getFieldsValue()).toEqual({ users: [{ name: "", age: 20 }] })

    form.destroy()
  })

  it("根数组替换和 reset 会重建全部 key", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Alice", age: 18 },
          { name: "Bob", age: 20 },
        ],
      },
    })

    const fieldArray = form.getOrCreateFieldArray("users")

    const initialKeys = fieldArray.getFields().map((field) => field.key)

    fieldArray.move(0, 1)
    const movedKeys = fieldArray.getFields().map((field) => field.key)

    form.setFieldValue("users", [
      { name: "Carol", age: 22 },
      { name: "Dan", age: 24 },
    ])
    const replacedKeys = fieldArray.getFields().map((field) => field.key)

    expect(movedKeys).toEqual([initialKeys[1], initialKeys[0]])
    expect(replacedKeys).not.toEqual(movedKeys)

    form.reset()
    const resetKeys = fieldArray.getFields().map((field) => field.key)

    expect(resetKeys).not.toEqual(replacedKeys)
    expect(getUserNames(form)).toEqual(["Alice", "Bob"])

    form.destroy()
  })

  it("吸收 FieldArray 创建前已注册的数组项 owner 并保留状态", () => {
    const store = createStore<FormValues>({
      initialValues: {
        users: [{ name: "Alice", age: 18 }],
      },
    })

    store.registerFieldPath("users.0.name" as any)
    store.setInitialValue("users.0.name" as any, "Alice (initial)")
    store.setFieldValue("users.0.name" as any, "Alice (current)")
    store.setFieldTouched("users.0.name" as any, true)
    store.setFieldPending("users.0.name" as any, true, "保存中")

    const fieldArrayHandle = store.getFieldArrayHandle("users")

    fieldArrayHandle.register()

    expect(fieldArrayHandle.getValue()).toEqual([{ name: "Alice (current)", age: 18 }])
    expect(store.getInitialValue("users.0.name" as any)).toBe("Alice (initial)")
    expect(store.isFieldTouched("users.0.name" as any)).toBe(true)
    expect(store.isFieldPending("users.0.name" as any)).toBe(true)

    store.setFieldValue("users.0.name" as any, "Alice Smith")

    expect(store.getFieldsSnapshot()).toEqual({
      users: [{ name: "Alice Smith", age: 18 }],
    })

    store.destroy()
  })

  it("FieldArray 创建后注册数组项字段时复用子路径 Signal", () => {
    const store = createStore<FormValues>({
      initialValues: {
        users: [{ name: "Alice", age: 18 }],
      },
    })

    store.getFieldArrayHandle("users").register()
    store.registerFieldPath("users.0.name" as any)
    store.setFieldValue("users.0.name" as any, "Alice Smith")

    expect(store.getFieldsSnapshot()).toEqual({
      users: [{ name: "Alice Smith", age: 18 }],
    })

    store.destroy()
  })

  it("同一路径普通 owner 可以升级为 FieldArray owner", () => {
    const store = createStore<FormValues>({
      initialValues: {
        users: [{ name: "Alice", age: 18 }],
      },
    })

    store.registerFieldPath("users" as any)
    const fieldArrayHandle = store.getFieldArrayHandle("users")

    fieldArrayHandle.register()

    expect(fieldArrayHandle.getStructure()).toHaveLength(1)
    expect(fieldArrayHandle.getValue()).toEqual([{ name: "Alice", age: 18 }])

    store.destroy()
  })

  it("FieldArray 与普通字段根可以共存", () => {
    const store = createStore<NestedFieldArrayForm>({
      initialValues: {
        profile: { items: [{ name: "Alice", age: 18 }] },
      },
    })

    store.registerFieldPath("profile" as any)

    expect(() =>
      store.getFieldArrayHandle("profile.items" as any).register()
    ).not.toThrow()

    store.destroy()
  })
})
