import { defineComponent, h, isReadonly, nextTick } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { createFormContext } from "../provideFormContext"
import { useFieldArray } from "../useFieldArray"

interface FormValues {
  users: Array<{ name: string }>
}

describe("useFieldArray", () => {
  it("将 Core FieldArray 投影为响应式 fields", async () => {
    const form = createForm<FormValues>({
      initialValues: { users: [{ name: "Alice" }] },
    })

    let fieldArray: ReturnType<typeof useFieldArray<FormValues, "users">> | undefined

    let secondFieldArray:
      ReturnType<typeof useFieldArray<FormValues, "users">> | undefined

    const Child = defineComponent({
      setup() {
        fieldArray = useFieldArray<FormValues, "users">("users")

        return () => h("div")
      },
    })

    const Sibling = defineComponent({
      setup() {
        secondFieldArray = useFieldArray<FormValues, "users">("users")

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(form)

        return () => h("section", [h(Child), h(Sibling)])
      },
    })

    const wrapper = mount(Parent)

    const firstKey = fieldArray?.fields.value[0].key

    expect(secondFieldArray?.fields).toBe(fieldArray?.fields)
    expect(isReadonly(fieldArray?.fields)).toBe(true)
    expect(isReadonly(fieldArray?.fields.value)).toBe(true)

    fieldArray?.append({ name: "Bob" })
    await nextTick()

    expect(form.getFieldsValue().users.map((user) => user.name)).toEqual(["Alice", "Bob"])
    expect(fieldArray?.fields.value[0].key).toBe(firstKey)
    expect(fieldArray?.fields.value).toEqual(form.getOrCreateFieldArray("users").getFields())

    fieldArray?.remove(0)
    await nextTick()

    expect(form.getFieldsValue().users.map((user) => user.name)).toEqual(["Bob"])

    wrapper.unmount()
    form.destroy()
  })
})
