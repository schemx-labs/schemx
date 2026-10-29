import { createField, createForm } from "../../index"

import type { FieldRef, FieldRefState } from "../../index"

interface Values {
  name: string
  age: number
}

const form = createForm<Values>({ initialValues: { name: "Ada", age: 20 } })

const ref: FieldRef<Values, "name"> = form.getFieldRef("name")

const state: FieldRefState<Values, "name"> = form.getFieldState(ref)

const field = createField(form, "name")

const value: string | undefined = field.getValue()

field.setValue("Grace")
field.setInitialValue("initial")
form.setFieldValue("name", (previous) => previous?.trim())
field.change("Grace")
form.getFieldsValue(["name", "age"])
void state
void value
// @ts-expect-error 引用保留初始字段的值类型。
field.setValue(20)
// @ts-expect-error 用户修改同样保留字段值类型。
field.change(20)
// @ts-expect-error 初始值不能使用其他字段的值类型。
field.setInitialValue(20)
// @ts-expect-error 字段引用不能通过路径字符串替代。
const forged: FieldRef<Values, "name"> = "name"

void forged
// @ts-expect-error 引用不提供字段方法。
ref.setValue("Ada")
// @ts-expect-error 引用不暴露内部状态。
void ref.state
// @ts-expect-error 创建引用时必须使用合法路径。
form.getFieldRef("missing")

const otherShape = createForm({ initialValues: { name: 1 } })

// @ts-expect-error 引用也保留所属表单的值类型，不能混用不兼容的表单形状。
form.getFieldState(otherShape.getFieldRef("name"))
// @ts-expect-error 不允许在普通对象上伪造字段引用。
const emptyRef: FieldRef<Values, "name"> = {}

void emptyRef

// @ts-expect-error Form 数据 API 只接受路径。
form.getFieldValue(ref)
// @ts-expect-error 批量数据 API 不再接受引用数组。
form.getFieldsValue([ref])
