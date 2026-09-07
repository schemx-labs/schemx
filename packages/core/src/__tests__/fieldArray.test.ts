import { describe, expect, it } from "vitest"

import { createForm, isSchemxViewFieldSchema, isViewDynamicSchema } from "../index"
import { createStore } from "../store/store"

import type { SchemxField } from "../types"

interface FormValues {
  users: Array<{
    name: string
    age: number
  }>
}

const schemas: SchemxField<FormValues>[] = [
  {
    key: "users",
    name: "users",
    item: [{ name: "name", label: "姓名", componentType: "input" }],
  },
]

function createUsersForm() {
  return createForm<FormValues>({
    initialValues: {
      users: [
        { name: "Alice", age: 18 },
        { name: "Bob", age: 20 },
      ],
    },
    schemas,
  })
}

function getDynamicView(form: ReturnType<typeof createUsersForm>) {
  const view = form.getViewSchemas()[0]

  if (!view || !isViewDynamicSchema(view)) {
    throw new Error("Dynamic ViewSchema 未生成")
  }

  return view
}

describe("动态数组结构", () => {
  it("函数式 updater 只执行一次并支持追加、删除和移动", () => {
    const form = createUsersForm()

    const initialView = getDynamicView(form)

    const initialKeys = initialView.items.map((item) => item.key)

    const currentUsers = form.getFieldValue("users")

    if (!currentUsers) {
      throw new Error("users 未初始化")
    }

    let updateCount = 0

    const added = { name: "Carol", age: 22 }

    form.setFieldValue("users", (users) => {
      updateCount += 1

      return [...(users ?? []), added]
    })

    expect(updateCount).toBe(1)
    expect(form.getFieldsValue().users).toEqual([...currentUsers, added])

    const appendedView = getDynamicView(form)

    expect(appendedView.items[0]?.key).toBe(initialKeys[0])
    expect(appendedView.items[1]?.key).toBe(initialKeys[1])

    const appendedKeys = appendedView.items.map((item) => item.key)

    form.setFieldValue("users", (users) => {
      const first = users?.[0]

      const third = users?.[2]

      return first && third ? [first, third] : []
    })

    const deletedView = getDynamicView(form)

    expect(deletedView.items.map((item) => item.key)).toEqual([
      appendedKeys[0],
      appendedKeys[2],
    ])

    form.setFieldValue("users", (users) => {
      const next = [...(users ?? [])]

      const moved = next.pop()

      if (moved) {
        next.unshift(moved)
      }

      return next
    })

    const movedView = getDynamicView(form)

    expect(movedView.items.map((item) => item.key)).toEqual([
      appendedKeys[2],
      appendedKeys[0],
    ])

    expect(
      movedView.items.flatMap((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
      )
    ).toEqual(["users.0.name", "users.1.name"])

    form.destroy()
  })

  it("克隆对象获得新 key，保留对象引用时 key 随行移动", () => {
    const form = createUsersForm()

    const users = form.getFieldValue("users")

    if (!users) {
      throw new Error("users 未初始化")
    }

    const initialKeys = getDynamicView(form).items.map((item) => item.key)

    form.setFieldValue("users", [users[1], users[0]])

    expect(getDynamicView(form).items.map((item) => item.key)).toEqual([
      initialKeys[1],
      initialKeys[0],
    ])

    form.setFieldValue("users", [{ ...users[1] }, users[0]])

    const clonedKeys = getDynamicView(form).items.map((item) => item.key)

    expect(clonedKeys[0]).not.toBe(initialKeys[1])
    expect(clonedKeys[1]).toBe(initialKeys[0])

    form.destroy()
  })

  it("setFieldsValue 使用同一套数组结构协调，并在 reset 时重建 key", () => {
    const form = createUsersForm()

    const users = form.getFieldValue("users")

    if (!users) {
      throw new Error("users 未初始化")
    }

    const initialKeys = getDynamicView(form).items.map((item) => item.key)

    form.setFieldsValue({ users: [users[1], { name: "Carol", age: 22 }] })

    const updatedKeys = getDynamicView(form).items.map((item) => item.key)

    expect(updatedKeys[0]).toBe(initialKeys[1])
    expect(updatedKeys[1]).not.toBe(initialKeys[0])

    form.reset()

    expect(getDynamicView(form).items.map((item) => item.key)).not.toEqual(updatedKeys)
    expect(form.getFieldsValue().users).toEqual([
      { name: "Alice", age: 18 },
      { name: "Bob", age: 20 },
    ])

    form.destroy()
  })

  it("受影响索引的 touched、pending 和 errors 会清理", () => {
    const form = createUsersForm()

    form.setFieldTouched("users.0.name", true)
    form.setFieldPending("users.0.name", true, "保存中")
    form.setFieldErrors("users.0.name", ["名称无效"])

    const users = form.getFieldValue("users")

    if (!users) {
      throw new Error("users 未初始化")
    }

    form.setFieldValue("users", [users[1], users[0]])

    expect(form.isFieldTouched("users.0.name")).toBe(false)
    expect(form.isFieldPending("users.0.name")).toBe(false)
    expect(form.getFieldErrors("users.0.name")).toEqual([])
    expect(form.getFieldErrors("users.1.name")).toEqual([])

    form.destroy()
  })

  it("数组根移除会清空值和全部结构 key", () => {
    const store = createStore<{ users: Array<{ name: string }> }>({
      initialValues: { users: [{ name: "Alice" }, { name: "Bob" }] },
    })

    const structure = store.getArrayStructureHandle("users")

    structure.register()
    expect(structure.getKeys()).toHaveLength(2)

    store.removeFieldValue("users")

    expect(Object.hasOwn(store.getFieldsValue(), "users")).toBe(false)
    expect(structure.getKeys()).toEqual([])

    store.destroy()
  })

  it("原始重复值按旧数组出现顺序复用 key", () => {
    const store = createStore<{ values: number[] }>({
      initialValues: { values: [1, 1, 2] },
    })

    const structure = store.getArrayStructureHandle("values")

    structure.register()
    const initialKeys = [...structure.getKeys()]

    store.setFieldValue("values", (values) => {
      const first = values?.[0]

      const second = values?.[1]

      const third = values?.[2]

      return first !== undefined && second !== undefined && third !== undefined
        ? [second, first, third]
        : []
    })

    expect(structure.getKeys()).toEqual(initialKeys)

    store.destroy()
  })
})
