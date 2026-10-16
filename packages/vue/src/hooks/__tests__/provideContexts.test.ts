import { defineComponent, h, nextTick, ref } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vite-plus/test"

import { useFieldContext } from "../../context/fieldContext"
import {
  provideFormContext,
  useFormContextValue,
  useOptionalFormContextValue,
} from "../../context/formContext"
import {
  createFormConfigContext,
  createFormContext,
  useFormConfigContext,
  useFormContext,
  useFormRuntimeContext,
} from "../../context/formContext.compat"

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

  it.each(["form-first", "config-first"])(
    "旧提供函数在同一 setup 中按 %s 顺序组合",
    async (order) => {
      const form = createForm({ initialValues: { name: "legacy" } })

      const readonly = ref(false)

      let context: ReturnType<typeof useFormContextValue> | undefined

      const Consumer = defineComponent({
        setup() {
          context = useFormContextValue()
          expect(useFormContextValue()).toBe(context)
          expect(useFormContext()).toBe(context.form)
          expect(useFormRuntimeContext().instance).toBe(context.form)

          return () => h("div", String(context?.schemaConfig.readonly))
        },
      })

      const Provider = defineComponent({
        setup() {
          const config = {
            get schemaConfig() {
              return { readonly: readonly.value }
            },
          }

          if (order === "form-first") {
            createFormContext(form)
            createFormConfigContext(config)
          } else {
            createFormConfigContext(config)
            createFormContext(form)
          }

          return () => h(Consumer)
        },
      })

      const wrapper = mount(Provider)

      expect(context?.form.getFieldValue("name")).toBe("legacy")
      expect(wrapper.text()).toBe("false")
      readonly.value = true
      await nextTick()
      expect(wrapper.text()).toBe("true")
      wrapper.unmount()
      form.destroy()
    }
  )

  it.each(["form", "config"])(
    "旧提供函数仅覆盖 %s 时继承另一项且不修改父级",
    async (part) => {
      const outerForm = createForm({ initialValues: { name: "outer" } })

      const innerForm = createForm({ initialValues: { name: "inner" } })

      const readonly = ref(false)

      const contexts: ReturnType<typeof useFormContextValue>[] = []

      const Consumer = defineComponent({
        setup() {
          const context = useFormContextValue()

          contexts.push(context)

          return () =>
            h(
              "div",
              `${context.form.getFieldValue("name")}:${context.schemaConfig.readonly}`
            )
        },
      })

      const Inner = defineComponent({
        setup() {
          if (part === "form") {
            createFormContext(innerForm)
          } else {
            createFormConfigContext({
              get schemaConfig() {
                return { readonly: readonly.value }
              },
            })
          }

          return () => h(Consumer)
        },
      })

      const Outer = defineComponent({
        setup() {
          provideFormContext({
            form: outerForm,
            get schemaConfig() {
              return { readonly: readonly.value }
            },
          })

          return () => h("section", [h(Consumer), h(Inner)])
        },
      })

      const wrapper = mount(Outer)

      expect(contexts[0]?.form.getFieldValue("name")).toBe("outer")
      expect(contexts[1]?.form.getFieldValue("name")).toBe(
        part === "form" ? "inner" : "outer"
      )
      readonly.value = true
      await nextTick()
      expect(contexts.every((context) => context.schemaConfig.readonly === true)).toBe(
        true
      )
      wrapper.unmount()
      outerForm.destroy()
      innerForm.destroy()
    }
  )

  it("只有实例或只有配置时保持旧读取入口及完整入口的缺失行为", () => {
    const form = createForm({ initialValues: { name: "partial" } })

    const config = { schemaConfig: { readonly: true } }

    for (const part of ["form", "config"]) {
      const Consumer = createConsumer(() => {
        expect(useOptionalFormContextValue()).toBeUndefined()
        expect(useFormContextValue).toThrow("[schemx] useFormContextValue()")
        if (part === "form") {
          expect(useFormContext().getFieldValue("name")).toBe("partial")
          expect(useFormConfigContext).toThrow("[schemx] useFormConfigContext()")
        } else {
          expect(useFormConfigContext()).toBe(config)
          expect(useFormContext).toThrow("[schemx] useFormContext()")
        }
      })

      const Provider = defineComponent({
        setup() {
          if (part === "form") {
            createFormContext(form)
          } else {
            createFormConfigContext(config)
          }

          return () => h(Consumer)
        },
      })

      mount(Provider).unmount()
    }

    form.destroy()
  })

  it("完整提供入口覆盖旧上下文且保持配置 getter", async () => {
    const outerForm = createForm({ initialValues: { name: "old" } })

    const innerForm = createForm({ initialValues: { name: "new" } })

    const readonly = ref(false)

    const Consumer = defineComponent({
      setup() {
        const context = useFormContextValue()

        expect(useFormContextValue()).toBe(context)

        return () =>
          h(
            "div",
            `${context.form.getFieldValue("name")}:${context.schemaConfig.readonly}`
          )
      },
    })

    const Inner = defineComponent({
      setup() {
        provideFormContext({
          form: innerForm,
          get schemaConfig() {
            return { readonly: readonly.value }
          },
        })

        return () => h(Consumer)
      },
    })

    const Outer = defineComponent({
      setup() {
        createFormContext(outerForm)
        createFormConfigContext({ schemaConfig: { readonly: true } })

        return () => h(Inner)
      },
    })

    const wrapper = mount(Outer)

    expect(wrapper.text()).toBe("new:false")
    readonly.value = true
    await nextTick()
    expect(wrapper.text()).toBe("new:true")
    wrapper.unmount()
    outerForm.destroy()
    innerForm.destroy()
  })
})
