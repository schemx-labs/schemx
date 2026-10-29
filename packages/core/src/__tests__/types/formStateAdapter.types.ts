import { createForm, createFormStateAdapter } from "../../index"

import type { DeepReadonly, FieldStateSnapshot, SnapshotSource } from "../../index"

interface FormValues {
  profile: { name: string }
  tags: string[]
}

// 快照复用原生状态的结构共享引用，所有嵌套值都只允许读取。
const form = createForm<FormValues>({
  initialValues: { profile: { name: "Ada" }, tags: ["first"] },
})

const adapter = createFormStateAdapter(form)

const values: DeepReadonly<FormValues> = adapter.values.getSnapshot()

const field: SnapshotSource<FieldStateSnapshot<FormValues, "profile">> =
  adapter.field("profile")

const profile: DeepReadonly<{ name: string }> | undefined = field.getSnapshot().value

const stop: () => void = adapter.values.subscribe(() => {})

void values
void profile
void stop
// @ts-expect-error 共享值树的嵌套对象只读。
adapter.values.getSnapshot().profile.name = "Grace"
// @ts-expect-error 共享值树的数组只读。
adapter.values.getSnapshot().tags.push("second")
if (profile) {
  // @ts-expect-error 字段对象值也只读。
  profile.name = "Grace"
}

// @ts-expect-error 聚合列表不能直接写入。
adapter.touchedFields.getSnapshot().push("profile.name")
const pending = adapter.pendingFields.getSnapshot()[0]

if (pending) {
  // @ts-expect-error pending 消息列表只读。
  pending.message.push("new")
}

// @ts-expect-error 路径必须存在。
adapter.field("missing")

// 控制器来源保留初始路径的值类型，所有属性均为只读快照。
const bound = adapter.field(form.getFieldRef("profile"))

const boundProfile: DeepReadonly<FormValues["profile"]> | undefined =
  bound.value.getSnapshot()

const currentName: "profile" | "profile.name" | "tags" | `tags.${number}` | undefined =
  bound.name.getSnapshot()

const disposed: boolean = bound.disposed.getSnapshot()

const value = adapter.bind(form.getFieldState(form.getFieldRef("profile")).value)

void boundProfile
void currentName
void disposed
void value
// @ts-expect-error 数组字段来源不能赋给数字快照。
const invalidValue: number = adapter.field("tags").value.getSnapshot()

void invalidValue
if (boundProfile) {
  // @ts-expect-error 控制器对象值不能直接修改。
  boundProfile.name = "Grace"
}
