/**
 * useField 与共享 Vue Field Bridge 测试。
 *
 * @module hooks/__tests__/useField
 */

import { defineComponent, h, nextTick, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import { createFieldHook, useField } from ".."
import { acquireVueFormRuntime } from "../../bridge"
import { createFormContext } from "../../context"

import type { VueFormRuntime } from "../../bridge"
import type { FieldInstance } from "../../types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

// 内存中的字段 owner，直接复用真实 Runtime 的资源释放流程。
interface FieldHarness<TValues extends Values, TName extends NamePath<TValues>> {
  // 具有 Vue Ref 的字段控制器。
  field: FieldInstance<TValues, TName>
  // 同一 Core 实例共享的桥接 Runtime。
  runtime: VueFormRuntime<TValues>
  // 仅释放本次测试 owner，不销毁原始表单。
  release(this: void): void
}

/**
 * 创建一个字段的桥接 owner，便于验证身份和资源复用。
 * @param form - 测试持有的原始 Core 表单。
 * @param name - 本次首次定位的字段路径。
 */
function createFieldHarness<TValues extends Values, TName extends NamePath<TValues>>(
  form: SchemxInstance<TValues>,
  name: TName
): FieldHarness<TValues, TName> {
  const { runtime, release } = acquireVueFormRuntime(form)

  return { runtime, release, field: createFieldHook(runtime, name) }
}

describe("useField", () => {
  it("Ref 整体赋值提交到 Core，保留程序赋值语义", () => {
    const onChange = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ name: "name", label: "姓名", componentType: "input", onChange }],
    })

    const { field, release } = createFieldHarness(form, "name")

    field.value.value = "Grace"
    expect(form.getFieldValue("name")).toBe("Grace")
    expect(field.getValue()).toBe("Grace")
    expect(field.isTouched()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    form.setFieldValue("name", "Lin")
    expect(field.value.value).toBe("Lin")

    release()
    form.destroy()
  })

  it("同 key 改名后读写跟随节点，Form 路径来源保留原目标", () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "person", name: "name", label: "姓名", componentType: "input" }],
    })

    const { field, runtime, release } = createFieldHarness(form, "name")

    const fixedPath = runtime.getFieldState("name")

    form.setFieldErrors("nickname", ["昵称错误"])
    form.setFieldTouched("nickname", true)
    form.setFieldPending("nickname", true)
    form.setSchemas([
      { key: "person", name: "nickname", label: "昵称", componentType: "input" },
    ])

    expect(field.name).toBe("nickname")
    expect(field.value.value).toBe("A")
    expect(field.getValue()).toBe("A")
    expect(field.errors.value).toEqual(["昵称错误"])
    expect(field.dirty.value).toBe(true)
    expect(field.pending.value).toBe(true)
    field.value.value = "Updated"
    expect(form.getFieldValue("nickname")).toBe("Updated")
    expect(fixedPath.value.value).toBe("Ada")

    release()
    form.destroy()
  })

  it("数组重排后读取和赋值仍跟随原行", () => {
    const form = createForm({
      initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
      schemas: [
        {
          key: "users",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    const { field, release } = createFieldHarness(form, "users.0.name")

    form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
    expect(field.name).toBe("users.1.name")
    expect(field.getValue()).toBe("Ada")
    field.value.value = "Updated"
    expect(form.getFieldValue("users.1.name")).toBe("Updated")
    expect(form.getFieldValue("users.0.name")).toBe("Grace")

    release()
    form.destroy()
  })

  it("旧节点失效后不接管同址新节点，订阅观察当前路径变化", async () => {
    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ key: "old", name: "name", label: "姓名", componentType: "input" }],
    })

    const { field, release } = createFieldHarness(form, "name")

    const names: (string | undefined)[] = []

    const stop = watchEffect(() => {
      names.push(field.name)
    })

    form.setSchemas([])
    await nextTick()
    expect(field.name).toBeUndefined()
    expect(field.value.value).toBeUndefined()
    expect(field.errors.value).toEqual([])
    form.setSchemas([
      { key: "new", name: "name", label: "新姓名", componentType: "input" },
    ])
    form.setFieldValue("name", "Replacement")
    field.value.value = "Stale"
    expect(form.getFieldValue("name")).toBe("Replacement")
    expect(field.getValue()).toBeUndefined()
    expect(names).toEqual(["name", undefined])

    stop()
    release()
    form.destroy()
  })

  it("手动字段保留固定路径，Form 销毁后发布失效状态", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const { field, release } = createFieldHarness(form, "name")

    form.setSchemas([{ name: "name", label: "姓名", componentType: "input" }])
    form.setSchemas([])
    field.value.value = "Manual"
    expect(field.name).toBe("name")
    expect(form.getFieldValue("name")).toBe("Manual")
    form.destroy()
    expect(field.name).toBeUndefined()
    expect(field.getValue()).toBeUndefined()
    expect(field.value.value).toBeUndefined()
    release()
  })

  it("重复获取同一字段复用订阅，最后一个 owner 释放后停止同步", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const subscribe = vi.spyOn(form.createField("name").state.value, "subscribe")

    const first = createFieldHarness(form, "name")

    const subscriptions = subscribe.mock.calls.length

    const second = createFieldHarness(form, "name")

    expect(subscribe).toHaveBeenCalledTimes(subscriptions)
    first.release()
    form.setFieldValue("name", "Grace")
    expect(second.field.getValue()).toBe("Grace")
    second.release()
    form.setFieldValue("name", "Lin")
    expect(second.field.getValue()).toBe("Grace")
    form.destroy()
  })

  it("字段读取方法使用共享 Vue Field Bridge", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada", age: 20 } })

    const values: Array<string | number | undefined> = []

    const errors: string[][] = []

    const touched: boolean[] = []

    const pending: boolean[] = []

    let allValuesReads = 0

    let field: FieldInstance<{ name: string; age: number }> | undefined

    const Child = defineComponent({
      setup() {
        const instance = useField<{ name: string; age: number }>("name")

        field = instance

        watchEffect(() => {
          values.push(instance.getValue())
        })
        watchEffect(() => {
          errors.push([...instance.getErrors()])
        })
        watchEffect(() => {
          touched.push(instance.isTouched())
        })
        watchEffect(() => {
          pending.push(instance.isPending())
        })
        watchEffect(() => {
          instance.getValues()
          allValuesReads++
        })

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(coreForm)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    coreForm.setFieldValue("age", 21)
    coreForm.setFieldValue("name", "Grace")
    coreForm.setFieldErrors("name", ["无效名称"])
    coreForm.setFieldTouched("name", true)
    coreForm.setFieldPending("name", true, "保存中")
    await nextTick()

    expect(field?.getValue()).toBe("Grace")
    expect(values).toEqual(["Ada", "Grace"])
    expect(errors).toEqual([[], ["无效名称"]])
    expect(touched).toEqual([false, true])
    expect(pending).toEqual([false, true])
    expect(allValuesReads).toBe(2)

    wrapper.unmount()
    coreForm.destroy()
  })

  it("Provider scope 停止后释放字段 Bridge", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    let field: FieldInstance<{ name: string }> | undefined

    const Child = defineComponent({
      setup() {
        field = useField<{ name: string }>("name")

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(coreForm)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    coreForm.setFieldValue("name", "Grace")
    await nextTick()
    wrapper.unmount()

    coreForm.setFieldValue("name", "Lin")
    await nextTick()

    expect(field?.getValue()).toBe("Grace")

    coreForm.destroy()
  })
})
