import { createForm, createFormStateAdapter, getFormAdapter } from "../../index"

// Core 仅提供路径操作，公开入口没有身份引用。
const form = createForm({ initialValues: { name: "Ada" } })

// 原生状态只接受业务路径。
const native = getFormAdapter(form)

// 快照协议具有相同的路径约束。
const snapshot = createFormStateAdapter(form)

// @ts-expect-error Form 不再提供字段身份引用。
form.getFieldRef("name")
// @ts-expect-error Form 不再解析字段引用。
form.getFieldName({})
// @ts-expect-error 字段状态通过路径 adapter 获取。
form.getFieldState({})
// @ts-expect-error 原生 adapter 不接受身份对象。
native.field({})
// @ts-expect-error 快照 adapter 不接受身份对象。
snapshot.field({})
// @ts-expect-error 路径状态没有身份失效标记。
void native.field("name").disposed
// @ts-expect-error 快照来源没有当前身份路径。
void snapshot.field("name").name
