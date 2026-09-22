import { defineComponent, h, nextTick, ref } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { useFieldContext } from "../../context/fieldContext"
import {
  provideFormContext,
  useFormConfigContext,
  useFormContext,
  useFormContextValue,
} from "../../context/formContext"

const createConsumer = (consume: () => unknown) =>
  defineComponent({
    setup() {
      consume()
    },
    template: "<div />",
  })

const mountConsumer = (consume: () => unknown) =>
  mount(createConsumer(consume), {
    global: {
      config: {
        warnHandler: () => undefined,
      },
    },
  })

describe("provide/inject context hooks", () => {
  it("在缺少表单配置上下文时提供 setup 指引", () => {
    expect(() => mountConsumer(useFormConfigContext)).toThrow(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  })

  it("在缺少表单实例上下文时提供 setup 指引", () => {
    expect(() => mountConsumer(useFormContext)).toThrow(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure provideFormContext({ form, schemaConfig }) is called synchronously during setup()."
    )
  })

  it("在缺少字段上下文时说明所需的 provider", () => {
    expect(() => mountConsumer(useFieldContext)).toThrow(
      "[schemx] useFieldContext() must be called inside a component tree where " +
        "createFieldContext(field) has been called."
    )
  })

  it("统一 Form Context 向嵌套子树提供最近的实例和配置", () => {
    const outerForm = createForm({ initialValues: { name: "outer" } })

    const innerForm = createForm({ initialValues: { name: "inner" } })

    let context: ReturnType<typeof useFormContextValue> | undefined

    const Consumer = defineComponent({
      setup() {
        context = useFormContextValue()

        return () => h("div")
      },
    })

    const Inner = defineComponent({
      setup() {
        provideFormContext({
          form: innerForm,
          schemaConfig: { readonly: true },
        })

        return () => h(Consumer)
      },
    })

    const Outer = defineComponent({
      setup() {
        provideFormContext({
          form: outerForm,
          schemaConfig: { readonly: false },
        })

        return () => h(Inner)
      },
    })

    const wrapper = mount(Outer)

    expect(context?.form.getFieldValue("name")).toBe("inner")
    expect(context?.schemaConfig.readonly).toBe(true)

    wrapper.unmount()
    outerForm.destroy()
    innerForm.destroy()
  })

  it("统一 Form Context 保持展示配置响应式", async () => {
    const form = createForm({ initialValues: {} })

    const readonly = ref(false)

    let config: ReturnType<typeof useFormConfigContext> | undefined

    const Consumer = defineComponent({
      setup() {
        config = useFormConfigContext()

        return () => h("div", String(config?.schemaConfig.readonly))
      },
    })

    const Provider = defineComponent({
      setup() {
        provideFormContext({
          form,
          get schemaConfig() {
            return { readonly: readonly.value }
          },
        })

        return () => h(Consumer)
      },
    })

    const wrapper = mount(Provider)

    expect(wrapper.text()).toBe("false")
    readonly.value = true
    await nextTick()
    expect(wrapper.text()).toBe("true")

    wrapper.unmount()
    form.destroy()
  })
})
