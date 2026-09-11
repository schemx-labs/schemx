import { defineComponent, h, markRaw, nextTick, ref } from "vue"

import { createRendererRegistry, type SchemxInstance } from "@schemx/core"
import { mount, type VueWrapper } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SchemxForm from "../../../form.vue"
import { useFormConfigContext } from "../../../context/formContext.js"
import { useForm } from "../../../hooks/useForm"
import ConfigProvider from "../index"

import type { SchemxConfig } from "@schemx/core"

const ProviderRenderer = defineComponent({
  name: "ProviderRenderer",
  setup() {
    return () => h("input")
  },
})

const FormConfigRenderer = defineComponent({
  name: "FormConfigRenderer",
  setup() {
    const formConfig = useFormConfigContext()

    return () =>
      h("input", {
        "data-readonly": String(formConfig.schemaConfig.readonly),
        "data-label-align": formConfig.schemaConfig.labelAlign,
      })
  },
})

const ProviderColA = defineComponent({
  name: "ProviderColA",
  setup(_, { slots }) {
    return () => h("section", { "data-testid": "provider-col-a" }, slots.default?.())
  },
})

const ProviderColB = defineComponent({
  name: "ProviderColB",
  setup(_, { slots }) {
    return () => h("section", { "data-testid": "provider-col-b" }, slots.default?.())
  },
})

interface FormHostResult {
  form: SchemxInstance | undefined
  wrapper: VueWrapper
}

/**
 * 在指定 Provider 子树中创建一个 Form。
 *
 * @param providerProps - Provider 的顶层配置 Props。
 * @param formOptions - 子组件 useForm() 的显式配置。
 * @param nestedProvider - 可选的内层 Provider 配置。
 * @returns 创建的 Form 与宿主 wrapper。
 */
function mountProviderForm(
  providerProps: SchemxConfig = {},
  formOptions: Parameters<typeof useForm>[0] = {},
  nestedProvider?: SchemxConfig
): FormHostResult {
  let form: SchemxInstance | undefined

  const Host = defineComponent({
    name: "ProviderFormHost",
    setup() {
      form = useForm(formOptions)

      return () => h("div")
    },
  })

  const content = nestedProvider
    ? h(ConfigProvider, nestedProvider, { default: () => h(Host) })
    : h(Host)

  const wrapper = mount(ConfigProvider, {
    props: providerProps,
    slots: { default: () => content },
  })

  return { form, wrapper }
}

describe("ConfigProvider", () => {
  it("将顶层配置提供给后代 useForm", () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("provider", markRaw(ProviderRenderer))

    const { form, wrapper } = mountProviderForm(
      {
        schemaConfig: {
          readonly: true,
          visible: false,
          validationTrigger: "change",
        },
        rendererProps: { provider: { placeholder: "来自 Provider" } },
        rendererRegistry,
      },
      {
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "provider",
          },
        ],
      }
    )

    if (!form) {
      wrapper.unmount()
      throw new Error("Provider 子组件未创建 Form")
    }

    expect(form.getRenderer("provider")).toBe(ProviderRenderer)
    expect(form.getViewSchemas()[0]).toMatchObject({
      readonly: true,
      visible: false,
      validationTrigger: ["change"],
      componentProps: { placeholder: "来自 Provider" },
    })

    wrapper.unmount()
  })

  it("嵌套 Provider 覆盖冲突配置并保留父级配置", () => {
    const outerRegistry = createRendererRegistry()

    outerRegistry.register("outer", markRaw(ProviderRenderer))

    const innerRegistry = createRendererRegistry()

    innerRegistry.register("inner", markRaw(ProviderRenderer))

    const { form, wrapper } = mountProviderForm(
      {
        schemaConfig: { readonly: true, labelAlign: "left" },
        rendererRegistry: outerRegistry,
      },
      {
        schemaConfig: { readonly: false },
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "inner",
          },
        ],
      },
      {
        schemaConfig: { disabled: true, labelAlign: "right" },
        rendererRegistry: innerRegistry,
      }
    )

    if (!form) {
      wrapper.unmount()
      throw new Error("Provider 子组件未创建 Form")
    }

    expect(form.hasRenderer("outer")).toBe(false)
    expect(form.hasRenderer("inner")).toBe(true)
    expect(form.getViewSchemas()[0]).toMatchObject({
      readonly: false,
      disabled: true,
      labelAlign: "right",
    })

    wrapper.unmount()
  })

  it("使内部 SchemxForm 的展示 Context 继承 Provider 配置", () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("context", markRaw(FormConfigRenderer))

    const wrapper = mount(ConfigProvider, {
      props: {
        schemaConfig: { readonly: true, labelAlign: "center" },
        rendererRegistry,
      },
      slots: {
        default: () =>
          h(SchemxForm, {
            schemas: [
              {
                name: "name",
                label: "姓名",
                componentType: "context",
              },
            ],
          }),
      },
    })

    expect(wrapper.find("input").attributes("data-readonly")).toBe("true")
    expect(wrapper.find("input").attributes("data-label-align")).toBe("center")

    wrapper.unmount()
  })

  it("动态更新内部 SchemxForm 的展示配置和 Core 配置", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("context", markRaw(FormConfigRenderer))

    const formRef = ref<SchemxInstance>()

    const formReadonly = ref<boolean | undefined>()

    const FormHost = defineComponent({
      setup() {
        return () =>
          h(SchemxForm, {
            ref: formRef,
            readonly: formReadonly.value,
            schemas: [
              {
                name: "name",
                label: "姓名",
                componentType: "context",
              },
            ],
          })
      },
    })

    const wrapper = mount(ConfigProvider, {
      props: {
        schemaConfig: { readonly: true, labelAlign: "center" },
        rendererRegistry,
        colComponent: ProviderColA,
      },
      slots: {
        default: () => h(FormHost),
      },
    })

    expect(wrapper.find("input").attributes("data-readonly")).toBe("true")
    expect(formRef.value?.getViewSchemas()[0]).toMatchObject({ readonly: true })
    expect(wrapper.find("[data-testid='provider-col-a']").exists()).toBe(true)

    formReadonly.value = false
    await nextTick()

    expect(wrapper.find("input").attributes("data-readonly")).toBe("false")
    expect(formRef.value?.getViewSchemas()[0]).toMatchObject({ readonly: false })

    formReadonly.value = undefined
    await nextTick()

    expect(wrapper.find("input").attributes("data-readonly")).toBe("true")
    expect(formRef.value?.getViewSchemas()[0]).toMatchObject({ readonly: true })

    await wrapper.setProps({
      schemaConfig: { readonly: false, labelAlign: "left" },
      colComponent: ProviderColB,
    })
    await nextTick()

    expect(wrapper.find("input").attributes("data-readonly")).toBe("false")
    expect(wrapper.find("input").attributes("data-label-align")).toBe("left")
    expect(formRef.value?.getViewSchemas()[0]).toMatchObject({ readonly: false })
    expect(wrapper.find("[data-testid='provider-col-b']").exists()).toBe(true)

    wrapper.unmount()
  })
})
