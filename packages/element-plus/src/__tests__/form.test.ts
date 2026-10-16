// @vitest-environment happy-dom

import {
  createApp,
  defineComponent,
  effectScope,
  h,
  markRaw,
  nextTick,
  onMounted,
  ref,
} from "vue"
import type { App, Component } from "vue"

import VueForm, {
  configureSchemx as configureCore,
  getGlobalSchemxConfig as getCoreConfig,
  rendererRegistry as vueRegistry,
  presetRuleRegistry as vueRules,
} from "@schemx/vue"
import { provideSchemxAppConfig } from "@schemx/vue"
import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import SchemxForm, {
  ConfigProvider,
  configureSchemx,
  createForm,
  createRendererRegistry,
  presetRuleRegistry,
  rendererRegistry,
  schemxForm,
  useForm,
} from "../index"

import type { SchemxField, SchemxInstance } from "../index"

interface FormValues {
  name: string
}

const schemas: SchemxField<FormValues>[] = [
  { name: "name", label: "Name", componentType: "input" },
]

afterEach(() => {
  configureSchemx()
  configureCore()
})

describe("Element Plus form entry", () => {
  it("局部组件无需安装或默认 Props 即提供完整 UI 配置", () => {
    const wrapper = mount(SchemxForm as Component, {
      props: { schemas, initialValues: { name: "A" }, submitter: false, resetter: false },
    })

    expect(wrapper.find(".el-input").exists()).toBe(true)
    expect(wrapper.find(".el-row").exists()).toBe(true)
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "text-align: right"
    )
    expect(wrapper.get(".schemx-field-wrapper").classes().includes("is-bordered")).toBe(
      false
    )
    expect(SchemxForm).toBe(schemxForm)
    expect(SchemxForm).not.toBe(VueForm)
    expect(SchemxForm.Field).toBe(VueForm.Field)
    wrapper.unmount()
  })

  it("外部 Provider 高于 UI 默认值，省略的 Boolean 不被包装层转换为 false", async () => {
    const wrapper = mount(ConfigProvider, {
      props: {
        schemaConfig: { labelWidth: 160, disabled: true, row: { justify: "center" } },
      },
      slots: {
        default: () =>
          h(SchemxForm as Component, {
            schemas,
            initialValues: { name: "A" },
            submitter: false,
            resetter: false,
          }),
      },
    })

    expect(wrapper.get("input").attributes("disabled")).toBeDefined()
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 160px"
    )
    expect(wrapper.get(".el-row").attributes("style")).toContain(
      "justify-content: center"
    )
    expect(wrapper.get(".el-row").attributes("style")).not.toContain(
      "--schemx-gutter-top: 7px"
    )
    await wrapper.setProps({ schemaConfig: { labelWidth: 180, disabled: false } })
    await vi.waitFor(() =>
      expect(wrapper.get("input").attributes("disabled")).toBeUndefined()
    )
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 180px"
    )
    await wrapper.setProps({ schemaConfig: {} })
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    expect(wrapper.get(".schemx-field__label").attributes("style")).not.toContain(
      "width: 180px"
    )
    wrapper.unmount()
  })

  it("局部 Props 覆盖 Provider，所有输入只转发一次", () => {
    const wrapper = mount(ConfigProvider, {
      props: { schemaConfig: { disabled: true, labelWidth: 160 } },
      slots: {
        default: () =>
          h(SchemxForm as Component, {
            schemas,
            disabled: false,
            labelWidth: 190,
            id: "ui-form",
            class: "local-class",
            style: { paddingTop: "3px" },
            submitter: false,
            resetter: false,
          }),
      },
    })

    expect(wrapper.get("input").attributes("disabled")).toBeUndefined()
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 190px"
    )
    expect(wrapper.findAll("#ui-form")).toHaveLength(1)
    expect(wrapper.findAll(".local-class")).toHaveLength(1)
    expect(wrapper.get(".local-class").attributes("style")).toContain("padding-top: 3px")
    wrapper.unmount()
  })

  it("转发 v-model、插槽、回调和完整实例，父 mounted 时 API 已可用", async () => {
    const formRef = ref<SchemxInstance<FormValues>>()

    const model = ref<FormValues>({ name: "A" })

    const updated = vi.fn()

    const finished = vi.fn()

    const reset = vi.fn()

    const changed = vi.fn()

    const mounted = vi.fn()

    const Host = defineComponent({
      setup() {
        onMounted(() => mounted(typeof formRef.value?.getFieldsValue))

        return () =>
          h(
            SchemxForm as Component,
            {
              ref: formRef,
              schemas,
              modelValue: model.value,
              "onUpdate:modelValue": (value: FormValues) => {
                model.value = value
                updated(value)
              },
              onFinish: finished,
              onReset: reset,
              onValuesChange: changed,
              resetter: false,
            },
            {
              nameLabel: () => h("b", { "data-label-slot": "" }, "Custom"),
              submitter: (props: { submit: () => unknown }) =>
                h("button", { "data-submit-slot": "", onClick: props.submit }, "Save"),
            }
          )
      },
    })

    const wrapper = mount(Host)

    const form = formRef.value

    if (!form) {
      throw new Error("包装组件未暴露 Form 实例")
    }

    expect(mounted).toHaveBeenCalledWith("function")
    expect("validateField" in form).toBe(true)
    expect(Object.keys(form)).toContain("scrollToField")
    expect(wrapper.find("[data-label-slot]").exists()).toBe(true)
    expect(wrapper.find(".schemx-actions-button--submit").exists()).toBe(false)
    form.setFieldValue("name", "B")
    await nextTick()
    await nextTick()
    expect(model.value.name).toBe("B")
    expect(updated).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledTimes(1)
    await form.submit()
    expect(finished).toHaveBeenCalledTimes(1)
    form.reset()
    await nextTick()
    expect(reset).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it("UI useForm 在组件 Provider 创建之前就提供 Renderer 和字段默认值", () => {
    const scope = effectScope()

    const form = scope.run(() =>
      useForm<FormValues>({
        schemas,
        initialValues: { name: "A" },
      })
    )

    if (!form) {
      throw new Error("UI Hook 未创建 Form")
    }

    const destroy = vi.spyOn(form, "destroy")

    const wrapper = mount(SchemxForm as Component, {
      props: { form, schemas, submitter: false, resetter: false },
    })

    expect(form.getRenderer("input")).toBe(rendererRegistry.get("input"))
    expect(form.getViewSchemas()[0]).toMatchObject({ col: { span: 12 } })
    expect(wrapper.find(".el-input").exists()).toBe(true)
    expect(wrapper.find(".el-col-12").exists()).toBe(true)
    wrapper.unmount()
    expect(destroy).not.toHaveBeenCalled()
    scope.stop()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it("裸 Core 外部实例保留配置、Registry、回调和生命周期", async () => {
    const registry = createRendererRegistry("input")

    const Custom = defineComponent({
      setup() {
        return () => h("input", { "data-custom-renderer": "" })
      },
    })

    registry.register("input", markRaw(Custom))
    const ownerFinish = vi.fn()

    const componentFinish = vi.fn()

    const form = createForm<FormValues>({
      schemas,
      rendererRegistry: registry,
      schemaConfig: { labelWidth: 70, col: { span: 6 } },
      onFinish: ownerFinish,
    })

    const destroy = vi.spyOn(form, "destroy")

    const wrapper = mount(SchemxForm as Component, {
      props: {
        form,
        schemas,
        onFinish: componentFinish,
        submitter: false,
        resetter: false,
      },
    })

    expect(wrapper.find("[data-custom-renderer]").exists()).toBe(true)
    expect(form.getRenderer("input")).toBe(Custom)
    expect(form.getViewSchemas()[0]).toMatchObject({ labelWidth: 70, col: { span: 6 } })
    await form.submit()
    expect(ownerFinish).toHaveBeenCalledTimes(1)
    expect(componentFinish).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(destroy).not.toHaveBeenCalled()
    form.destroy()
  })

  it("无参数安装不清除已有 App 配置，并注册独立 UI 组件", () => {
    const app = createApp({})

    const provide = vi.spyOn(app, "provide")

    const component = vi.spyOn(app, "component")

    SchemxForm.install(app)
    expect(provide).not.toHaveBeenCalled()
    expect(component).toHaveBeenCalledWith("SchemxForm", SchemxForm)
    expect(SchemxForm.install).not.toBe(VueForm.install)
    const wrapper = mount(SchemxForm as Component, {
      props: { schemas, submitter: false, resetter: false },
      global: {
        plugins: [
          {
            install(app: App) {
              provideSchemxAppConfig(app, { schemaConfig: { labelWidth: 210 } })
            },
          },
          SchemxForm,
        ],
      },
    })

    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 210px"
    )
    wrapper.unmount()
  })

  it("UI useForm 接受 App/Provider 配置和局部覆盖", () => {
    let form: SchemxInstance<FormValues> | undefined

    const Host = defineComponent({
      setup() {
        form = useForm<FormValues>({ schemas, schemaConfig: { labelWidth: 230 } })

        return () =>
          h(SchemxForm as Component, { form, schemas, submitter: false, resetter: false })
      },
    })

    const wrapper = mount(ConfigProvider, {
      props: { schemaConfig: { labelWidth: 220, disabled: true } },
      slots: { default: () => h(Host) },
      global: { plugins: [[SchemxForm, { schemaConfig: { col: { span: 8 } } }]] },
    })

    expect(form?.getViewSchemas()[0]).toMatchObject({
      labelWidth: 230,
      disabled: true,
      col: { span: 8 },
    })
    expect(wrapper.find(".el-col-8").exists()).toBe(true)
    wrapper.unmount()
  })

  it("同时导入另一 UI 包不会修改 Core/Vue 全局或本包 Registry", async () => {
    const coreConfig = { schemaConfig: { readonly: true } }

    configureCore(coreConfig)
    const before = getCoreConfig()

    const vueKeys = vueRegistry.keys()

    const vueRuleKeys = vueRules.keys()

    const keys = rendererRegistry.keys()

    const otherEntry = new URL("../../../vant/dist/index.mjs", import.meta.url).pathname

    const other: Pick<
      typeof import("../index"),
      | "default"
      | "rendererRegistry"
      | "presetRuleRegistry"
      | "useForm"
      | "createForm"
      | "configureSchemx"
    > = await import(otherEntry)

    expect(getCoreConfig()).toBe(before)
    expect(vueRegistry.keys()).toEqual(vueKeys)
    expect(vueRules.keys()).toEqual(vueRuleKeys)
    expect(rendererRegistry.keys()).toEqual(keys)
    expect(other.rendererRegistry).not.toBe(rendererRegistry)
    expect(other.presetRuleRegistry).not.toBe(presetRuleRegistry)
    configureSchemx({ schemaConfig: { readonly: true } })
    const ownForm = createForm<FormValues>({ schemas })

    const peerForm = other.createForm<FormValues>({ schemas })

    expect(ownForm.getViewSchemas()[0]).toMatchObject({ readonly: true })
    expect(peerForm.getViewSchemas()[0]).toMatchObject({ readonly: false })
    expect(getCoreConfig()).toBe(before)
    ownForm.destroy()
    peerForm.destroy()
    configureSchemx()
    const first = mount(SchemxForm as Component, { props: { schemas, readonly: false } })

    const second = mount(other.default as Component, {
      props: { schemas, readonly: false },
    })

    expect(first.find(".el-input").exists()).toBe(true)
    expect(second.find(".van-field").exists()).toBe(true)
    first.unmount()
    second.unmount()
    const scope = effectScope()

    const own = scope.run(() =>
      useForm<FormValues>({ schemas, schemaConfig: { readonly: false } })
    )

    const peer = scope.run(() =>
      other.useForm<FormValues>({ schemas, schemaConfig: { readonly: false } })
    )

    expect(own?.getRenderer("input")).toBe(rendererRegistry.get("input"))
    expect(peer?.getRenderer("input")).toBe(other.rendererRegistry.get("input"))
    scope.stop()
  })
  it("普通 Provider 同时覆盖两个 UI 包的表单", async () => {
    const otherEntry = new URL("../../../vant/dist/index.mjs", import.meta.url).pathname

    const other: Pick<typeof import("../index"), "default" | "ConfigProvider"> =
      await import(otherEntry)

    expect(other.ConfigProvider).toBe(ConfigProvider)
    const wrapper = mount(ConfigProvider, {
      props: { schemaConfig: { disabled: true, labelWidth: 175 } },
      slots: {
        default: () => [
          h(SchemxForm as Component, { schemas, submitter: false, resetter: false }),
          h(other.default as Component, { schemas, submitter: false, resetter: false }),
        ],
      },
    })

    expect(wrapper.find(".el-input").exists()).toBe(true)
    expect(wrapper.find(".van-field").exists()).toBe(true)
    for (const input of wrapper.findAll("input")) {
      expect(input.attributes("disabled")).toBeDefined()
    }

    for (const label of wrapper.findAll(".schemx-field__label")) {
      expect(label.attributes("style")).toContain("width: 175px")
    }

    wrapper.unmount()
  })
})
