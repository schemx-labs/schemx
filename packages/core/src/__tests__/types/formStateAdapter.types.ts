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
