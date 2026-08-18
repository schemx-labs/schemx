import { createForm, type FieldArrayPath } from "../../index"

interface Values {
  users: Array<{ name: string }>
  tags: string[]
  tuple: [string, string]
  mixed: string[] | string
  sections: Array<{ items: string[] }>
  profile: { name: string }
}

const form = createForm<Values>()

const users = form.getOrCreateFieldArray("users")

users.append({ name: "Alice" })
users.appendMany([{ name: "Bob" }])
users.insertMany(0, [{ name: "Carol" }])
users.update(0, { name: "Carol" })

const usersPath: FieldArrayPath<Values> = "users"

const tags = form.getOrCreateFieldArray("tags")

tags.append("tag")

// @ts-expect-error tuple 不是可动态增删的 FieldArray。
form.getOrCreateFieldArray("tuple")

// @ts-expect-error 数组与标量联合值不能创建 FieldArray。
form.getOrCreateFieldArray("mixed")

// @ts-expect-error 当前 FieldArray 不支持嵌套数组路径。
form.getOrCreateFieldArray("sections.0.items")

// @ts-expect-error 只有数组字段路径可以创建 FieldArray。
form.getOrCreateFieldArray("profile.name")

void usersPath
form.destroy()
