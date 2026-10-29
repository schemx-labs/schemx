import { createField, createForm, createFormStateAdapter } from "../../index"

import type { FieldState, ReadonlyState } from "../../index"

// 原生字段状态保留路径和值类型，内部结构共享值只允许读取。
const form = createForm({
  initialValues: { name: "Ada", count: 1, profile: { active: true } },
})

const state = form.getFieldState(form.getFieldRef("name"))

const name: ReadonlyState<string | undefined> = state.value

const count: ReadonlyState<number | undefined> = createField(form, "count").state.value

const active: FieldState<
  { name: string; count: number; profile: { active: boolean } },
  "profile.active"
> = form.getFieldState(form.getFieldRef("profile.active"))

void name
void count
void active
// @ts-expect-error 字段路径必须存在。
form.getFieldRef("missing")
// @ts-expect-error 字段值类型不能退化为其他字段的联合类型。
const invalid: ReadonlyState<number | undefined> = state.value

// @ts-expect-error 共享状态没有公开销毁入口。
state.dispose()
// @ts-expect-error 只读状态值必须通过 Core 操作更新。
state.value.value = "Grace"
// @ts-expect-error 结构共享的嵌套对象也不允许原地修改。
createFormStateAdapter(form).values.getSnapshot().profile.active = false
// @ts-expect-error 表单不再公开聚合状态入口。
void form.state
void invalid
