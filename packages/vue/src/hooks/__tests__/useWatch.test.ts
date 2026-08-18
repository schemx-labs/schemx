/**
 * useWatch 与 Vue Instance 兼容测试。
 *
 * @module hooks/__tests__/useWatch
 */

import { defineComponent, h } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { createFormContext } from "../provideFormContext"
import { useWatch } from "../useWatch"

describe("useWatch", () => {
  it("通过 Instance Context 仍使用原始 Core 订阅语义", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const values: Array<string | undefined> = []

    const Child = defineComponent({
      setup() {
        useWatch<{ name: string }>("name", (_snapshot, payload) => {
          values.push(payload.value)
        })

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(form)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    form.setFieldValue("name", "Grace")

    expect(values).toEqual(["Grace"])

    wrapper.unmount()
    form.destroy()
  })
})
