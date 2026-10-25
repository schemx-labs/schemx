import { createField, createForm } from "../../index"

import type { FieldState, FormState, ReadonlyState } from "../../index"

// 原生字段状态保留路径和值类型，内部结构共享值只允许读取。
const form = createForm({
  initialValues: { name: "Ada", count: 1, profile: { active: true } },
})

const state: FormState<{ name: string; count: number; profile: { active: boolean } }> =
  form.state

const name: ReadonlyState<string | undefined> = state.field("name").value

const count: ReadonlyState<number | undefined> = createField(form, "count").state.value

const active: FieldState<
  { name: string; count: number; profile: { active: boolean } },
  "profile.active"
> = form.state.field("profile.active")

void name
void count
void active
// @ts-expect-error 字段路径必须存在。
form.state.field("missing")
// @ts-expect-error 字段值类型不能退化为其他字段的联合类型。
const invalid: ReadonlyState<number | undefined> = form.state.field("name").value

// @ts-expect-error 共享状态没有公开销毁入口。
form.state.dispose()
// @ts-expect-error 只读状态值必须通过 Core 操作更新。
form.state.field("name").value.value = "Grace"
// @ts-expect-error 结构共享的嵌套对象也不允许原地修改。
form.state.values.value.profile.active = false
// @ts-expect-error 状态入口不能被替换。
form.state = state
void invalid
