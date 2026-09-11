/**
 * useField 与共享 Vue Field Bridge 测试。
 *
 * @module hooks/__tests__/useField
 */

import { defineComponent, h, nextTick, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { createFormContext } from "../../context/formContext"
import { useField } from "../useField"

import type { FieldInstance } from "../../types/field"

describe("useField", () => {
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
