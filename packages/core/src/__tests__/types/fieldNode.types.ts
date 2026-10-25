import { createField, createForm } from "../../index"

import type {
  NamePath,
  ReadonlyState,
  SchemxFieldInstance,
  SchemxFieldState,
  ValidationResult,
} from "../../index"

interface Values {
  name: string
  age: number
}

const form = createForm<Values>({
  initialValues: { name: "Ada", age: 20 },
  schemas: [{ name: "name", label: "姓名", componentType: "input" }],
})

const field: SchemxFieldInstance<Values, "name"> = form.createField("name")

const state: SchemxFieldState<Values, "name"> = field.state

const name: ReadonlyState<NamePath<Values> | undefined> = state.name

const value: ReadonlyState<string | undefined> = state.value

const result: Promise<ValidationResult<Values> | undefined> = field.change("Ada")

field.setValue(undefined)
void name
void value
void result
// @ts-expect-error 值类型按初始路径推导。
field.setValue(20)
// @ts-expect-error 当前路径只能由 Core 协调。
state.name.value = "name"
// @ts-expect-error 生命周期由 Core 管理。
field.dispose()
// @ts-expect-error 删除单独的公开节点入口。
form.getFieldNode(1)
// @ts-expect-error Form 方法同样按表单值类型约束路径。
form.createField("missing")
// @ts-expect-error 创建字段统一使用路径，不接收节点 ID。
form.createField(1)
// @ts-expect-error 独立函数保留相同的路径约束。
createField(form, 1)
// @ts-expect-error 不提供第二种 nodeId 参数形式。
createField(form, { nodeId: 1 })
