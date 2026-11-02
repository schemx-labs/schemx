import { shallowRef } from "vue"

import { createFieldHook } from "../../hooks"
import { createFieldContext, useField } from "../../index"

import type { VueFormRuntime } from "../../bridge"

// 同类型字段可由消费端切换路径，泛型保持字段值约束。
declare const runtime: VueFormRuntime<{ first: string; second: string; age: number }>

const path = shallowRef<"first" | "second">("first")

const field = createFieldHook(runtime, path)

const name: "first" | "second" = field.name

const value: string | undefined = field.getValue()

field.setValue("Ada")
createFieldContext(field)
// @ts-expect-error 字符串字段不接受数字。
field.setValue(1)
// @ts-expect-error 路径 Ref 只能切换到声明的字段。
path.value = "age"
// @ts-expect-error Vue 字段工具不再公开 Core 引用。
void field.ref
// @ts-expect-error Vue 字段工具不再公开 Core 引用状态。
void field.state
// @ts-expect-error getter 也必须返回有效路径。
createFieldHook(runtime, () => "missing")
// getter 和 Ref 都可通过公开 Hook 传入。
useField<{ first: string; second: string }, "first" | "second">(() => path.value)
useField<{ first: string; second: string }, "first" | "second">(path)
void name
void value
