// @vitest-environment happy-dom

import { defineComponent, effectScope, h, nextTick, ref } from "vue"
import type { App, Component, ComputedRef } from "vue"

import {
  configureSchemx as configureCore,
  createForm as createCoreForm,
  createPresetRuleRegistry,
  createRendererRegistry,
  createSchemx,
  getFormCreationConfig,
} from "@schemx/core"
import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createFormComponent, provideSchemxAppConfig } from "../index"
import * as vueApi from "../index"

import type {
  CreateSchemxOptions,
  SchemxApi,
  SchemxField,
  SchemxInstance,
} from "@schemx/core"

// 全部创建入口使用同一业务值与 Schema，比较配置而不依赖内部实现。
interface FormValues {
  name: string
}
const schemas: SchemxField<FormValues>[] = [
  { name: "name", label: "Name", componentType: "input" },
]

const options = { schemas, initialValues: { name: "A" } }

const Renderer = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h("input", attrs)
  },
})

/**
 * 模拟独立组件模块接入 API；测试夹具不属于工厂返回值。
 * @param api - 原始工厂对象。
 */
function scopedForm(api: SchemxApi): Component {
  return createFormComponent(api.createForm)
}

afterEach(() => {
  configureCore()
  vi.restoreAllMocks()
})

describe("createSchemx", () => {
  it("Vue 工厂共享默认 Registry，配置覆盖彼此独立", () => {
    const first = vueApi.createSchemx({
      schemaConfig: { labelWidth: 140, col: { span: 12 } },
    })

    const second = vueApi.createSchemx()

    expect(Object.keys(first).sort()).toEqual([
      "configureSchemx",
      "createForm",
      "getConfig",
      "presetRuleRegistry",
      "rendererRegistry",
    ])
    expect(first.getConfig().schemaConfig).toMatchObject({
      labelAlign: "right",
      labelWidth: 140,
      col: { span: 12 },
      validationTrigger: ["blur", "change"],
    })
    expect(first.rendererRegistry).toBe(vueApi.rendererRegistry)
    expect(second.rendererRegistry).toBe(first.rendererRegistry)
    expect(first.presetRuleRegistry).toBe(vueApi.presetRuleRegistry)
    expect(second.presetRuleRegistry).toBe(first.presetRuleRegistry)
    first.configureSchemx({ schemaConfig: { labelWidth: 200 }, debug: true })
    expect(second.getConfig().schemaConfig?.labelWidth).toBe("auto")
    const direct = first.createForm(options)

    const scope = effectScope()

    const hooked = scope.run(() => vueApi.useForm(options, first.createForm))

    expect(direct.getViewSchemas()[0]).toMatchObject({
      labelWidth: 200,
      labelAlign: "right",
    })
    expect(hooked?.getViewSchemas()[0]).toMatchObject({
      labelWidth: 200,
      labelAlign: "right",
    })
    first.configureSchemx()
    expect(first.getConfig().schemaConfig?.labelWidth).toBe(140)
    expect(first.getConfig().debug).toBeUndefined()
    direct.destroy()
    scope.stop()
  })
  it("显式提供 Registry 时按调用方要求共享", () => {
    const rendererRegistry = createRendererRegistry()

    const presetRuleRegistry = createPresetRuleRegistry()

    const first = vueApi.createSchemx({ rendererRegistry, presetRuleRegistry })

    const second = vueApi.createSchemx({ rendererRegistry, presetRuleRegistry })

    first.rendererRegistry.register("input", Renderer)
    expect(second.rendererRegistry.resolve("input")).toBe(Renderer)
    expect(first.presetRuleRegistry).toBe(presetRuleRegistry)
    expect(second.presetRuleRegistry).toBe(presetRuleRegistry)
  })
  it("直接创建与 Hook 创建传递全部默认项，显式 false 和性能选项优先", () => {
    const api = createSchemx({
      debug: true,
      schedulerOptions: { timeSliceMs: 3 },
      validationConcurrency: 1,
    })

    const create = vi.spyOn(api, "createForm")

    const direct = api.createForm(options)

    expect(direct.getViewSchemas()[0]?.debug).toBeDefined()
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config
    ).toMatchObject({
      debug: true,
      schedulerOptions: { timeSliceMs: 3 },
      validationConcurrency: 1,
    })
    const scope = effectScope()

    const hooked = scope.run(() =>
      vueApi.useForm(
        {
          ...options,
          debug: false,
          schedulerOptions: { idleTimeout: 20 },
          validationConcurrency: 2,
        },
        api.createForm
      )
    )

    expect(hooked?.getViewSchemas()[0]?.debug).toBeUndefined()
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config
    ).toMatchObject({
      debug: false,
      schedulerOptions: { idleTimeout: 20 },
      validationConcurrency: 2,
    })
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config.schedulerOptions
    ).not.toHaveProperty("timeSliceMs")
    direct.destroy()
    scope.stop()
  })

  it("App 和嵌套 Provider 支持完整默认项且过滤实例属性", () => {
    const api = createSchemx({
      debug: true,
      schedulerOptions: { timeSliceMs: 3 },
      validationConcurrency: 4,
    })

    const create = vi.spyOn(api, "createForm")

    const Provider = vueApi.ConfigProvider

    let form: SchemxInstance<FormValues> | undefined

    let config: CreateSchemxOptions | undefined

    const Host = defineComponent({
      setup() {
        config = vueApi.useConfigProviderContext()
        form = vueApi.useForm({ ...options, validationConcurrency: 1 }, api.createForm)

        return () => h("div")
      },
    })

    const appOptions = {
      debug: false,
      schedulerOptions: { idleTimeout: 30 },
      schemas,
      initialValues: { name: "ignored" },
    }

    const wrapper = mount(Provider, {
      props: { schedulerOptions: { timeSliceMs: 7 }, validationConcurrency: 3 },
      global: {
        plugins: [(app: App) => provideSchemxAppConfig(app, appOptions)],
      },
      slots: {
        default: () =>
          h(
            Provider,
            { debug: true, initialValues: { name: "ignored" } },
            { default: () => h(Host) }
          ),
      },
    })

    expect(config).not.toHaveProperty("schemas")
    expect(config).not.toHaveProperty("initialValues")
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config
    ).toMatchObject({
      debug: true,
      schedulerOptions: { timeSliceMs: 7 },
      validationConcurrency: 1,
    })
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config.schedulerOptions
    ).not.toHaveProperty("idleTimeout")
    expect(form?.getViewSchemas()[0]?.debug).toBeDefined()
    expect(form?.getFieldsValue()).toEqual({ name: "A" })
    wrapper.unmount()
  })

  it("组件省略 Boolean 时继承默认值，局部 Props 优先且已有 Runtime 不重配", async () => {
    const api = createSchemx({
      debug: true,
      schedulerOptions: { timeSliceMs: 3 },
      validationConcurrency: 1,
    })

    const create = vi.spyOn(api, "createForm")

    api.rendererRegistry.register("input", Renderer)
    const Form = scopedForm(api)

    const Provider = vueApi.ConfigProvider

    const inherited = ref<SchemxInstance<FormValues>>()

    const local = ref<SchemxInstance<FormValues>>()

    const fresh = ref<SchemxInstance<FormValues>>()

    const show = ref(false)

    const localDebug = ref(false)

    const wrapper = mount(Provider, {
      props: { schedulerOptions: { idleTimeout: 30 }, validationConcurrency: 3 },
      slots: {
        default: () => [
          h(Form, { ...options, ref: inherited, submitter: false, resetter: false }),
          h(Form, {
            ...options,
            ref: local,
            debug: localDebug.value,
            schedulerOptions: { timeSliceMs: 8 },
            validationConcurrency: 2,
            submitter: false,
            resetter: false,
          }),
          show.value
            ? h(Form, { ...options, ref: fresh, submitter: false, resetter: false })
            : undefined,
        ],
      },
    })

    expect(inherited.value?.getViewSchemas()[0]?.debug).toBeDefined()
    expect(local.value?.getViewSchemas()[0]?.debug).toBeUndefined()
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config
    ).toMatchObject({
      debug: false,
      schedulerOptions: { timeSliceMs: 8 },
      validationConcurrency: 2,
    })
    const oldCallCount = create.mock.calls.length

    api.configureSchemx({ debug: false, validationConcurrency: 5 })
    localDebug.value = true
    await wrapper.setProps({
      schedulerOptions: { idleTimeout: 40 },
      validationConcurrency: 4,
    })
    expect(create.mock.calls).toHaveLength(oldCallCount)
    expect(inherited.value?.getViewSchemas()[0]?.debug).toBeDefined()
    expect(local.value?.getViewSchemas()[0]?.debug).toBeUndefined()
    show.value = true
    await nextTick()
    expect(fresh.value?.getViewSchemas()[0]?.debug).toBeUndefined()
    expect(
      getFormCreationConfig(create.mock.results.at(-1)?.value)?.config
    ).toMatchObject({
      debug: false,
      schedulerOptions: { idleTimeout: 40 },
      validationConcurrency: 4,
    })
    wrapper.unmount()
  })

  it("外部 Form 不被共享性能配置重建或重新配置", () => {
    const api = createSchemx({
      debug: true,
      schedulerOptions: { timeSliceMs: 3 },
      validationConcurrency: 1,
    })

    const create = vi.spyOn(api, "createForm")

    api.rendererRegistry.register("input", Renderer)
    const external = createCoreForm({
      ...options,
      rendererRegistry: api.rendererRegistry,
      debug: false,
      validationConcurrency: 2,
    })

    const wrapper = mount(scopedForm(api), {
      props: {
        ...options,
        form: external,
        debug: true,
        validationConcurrency: 5,
        submitter: false,
        resetter: false,
      },
    })

    expect(create).not.toHaveBeenCalled()
    expect(external.getViewSchemas()[0]?.debug).toBeUndefined()
    wrapper.unmount()
    external.destroy()
  })

  it("同一 App 的普通 Provider 对不同工厂共同生效", () => {
    const first = createSchemx()

    const second = createSchemx()

    let firstForm: SchemxInstance<FormValues> | undefined

    let secondForm: SchemxInstance<FormValues> | undefined

    const Host = defineComponent({
      setup() {
        firstForm = vueApi.useForm(options, first.createForm)
        secondForm = vueApi.useForm(options, second.createForm)

        return () => h("div")
      },
    })

    const wrapper = mount(vueApi.ConfigProvider, {
      props: { schemaConfig: { disabled: true } },
      global: {
        plugins: [
          [
            (app: App) =>
              provideSchemxAppConfig(app, { schemaConfig: { labelWidth: 200 } }),
          ],
          [
            (app: App) =>
              provideSchemxAppConfig(app, { schemaConfig: { labelWidth: 300 } }),
          ],
        ],
      },
      slots: {
        default: () =>
          h(
            vueApi.ConfigProvider,
            { schemaConfig: { labelWidth: 240 } },
            { default: () => h(Host) }
          ),
      },
    })

    expect(firstForm?.getViewSchemas()[0]).toMatchObject({
      labelWidth: 240,
      disabled: true,
    })
    expect(secondForm?.getViewSchemas()[0]).toMatchObject({
      labelWidth: 240,
      disabled: true,
    })
    wrapper.unmount()
  })

  it("嵌套 Provider 继承标量，Row 整体替换，局部选项优先", async () => {
    const api = createSchemx()

    const Provider = vueApi.ConfigProvider

    let form: SchemxInstance<FormValues> | undefined

    let config: ComputedRef<CreateSchemxOptions> | undefined

    const Host = defineComponent({
      setup() {
        config = vueApi.useConfigProviderContextRef()
        expect(vueApi.useConfigProviderContext()).toBe(config?.value)
        form = vueApi.useForm(
          { ...options, schemaConfig: { labelWidth: 180 } },
          api.createForm
        )

        return () => h("div")
      },
    })

    const wrapper = mount(Provider, {
      props: { schemaConfig: { disabled: true, labelWidth: 100, row: { gutter: 8 } } },
      slots: {
        default: () =>
          h(
            Provider,
            {
              schemaConfig: {
                readonly: true,
                labelWidth: 160,
                row: { justify: "center" },
              },
            },
            { default: () => h(Host) }
          ),
      },
    })

    expect(form?.getViewSchemas()[0]).toMatchObject({
      readonly: true,
      disabled: true,
      labelWidth: 180,
    })
    expect(config?.value.schemaConfig?.row).toMatchObject({
      justify: "center",
    })
    await wrapper.setProps({ schemaConfig: { disabled: false, row: { gutter: 12 } } })
    expect(config?.value.schemaConfig).toMatchObject({
      disabled: false,
      labelWidth: 160,
      row: { justify: "center" },
    })
    wrapper.unmount()
  })

  it("不同 App 的同一工厂安装配置隔离，组件与 Hook 创建一致", () => {
    const api = createSchemx()

    const Form = scopedForm(api)

    api.rendererRegistry.register("input", Renderer)
    const forms: SchemxInstance<FormValues>[] = []

    const Host = defineComponent({
      setup() {
        forms.push(vueApi.useForm(options, api.createForm))

        return () =>
          h(Form, {
            ...options,
            submitter: false,
            resetter: false,
          })
      },
    })

    const first = mount(Host, {
      global: {
        plugins: [
          (app: App) =>
            provideSchemxAppConfig(app, { schemaConfig: { labelWidth: 220 } }),
        ],
      },
    })

    const second = mount(Host, {
      global: {
        plugins: [
          (app: App) =>
            provideSchemxAppConfig(app, { schemaConfig: { labelWidth: 320 } }),
        ],
      },
    })

    expect(forms[0]?.getViewSchemas()[0]).toMatchObject({ labelWidth: 220 })
    expect(forms[1]?.getViewSchemas()[0]).toMatchObject({ labelWidth: 320 })
    expect(first.get(".schemx-field__label").attributes("style")).toContain(
      "width: 220px"
    )
    expect(second.get(".schemx-field__label").attributes("style")).toContain(
      "width: 320px"
    )
    first.unmount()
    second.unmount()
  })

  it("Provider 更新不将新工厂配置带入旧组件，后续子树创建仍用新快照", async () => {
    const api = createSchemx({ schemaConfig: { labelWidth: 100 } })

    const Form = scopedForm(api)

    api.rendererRegistry.register("input", Renderer)
    const original = ref<SchemxInstance<FormValues>>()

    const fresh = ref<SchemxInstance<FormValues>>()

    const showFresh = ref(false)

    const wrapper = mount(vueApi.ConfigProvider, {
      props: { schemaConfig: { labelWidth: 150 } },
      slots: {
        default: () => [
          h(Form, {
            ...options,
            ref: original,
            submitter: false,
            resetter: false,
          }),
          showFresh.value
            ? h(Form, {
                ...options,
                ref: fresh,
                submitter: false,
                resetter: false,
              })
            : undefined,
        ],
      },
    })

    const originalForm = original.value

    if (originalForm === undefined) {
      throw new Error("original form was not exposed")
    }

    expect(originalForm.getViewSchemas()[0]).toMatchObject({ labelWidth: 150 })
    expect(getFormCreationConfig(originalForm)?.defaults?.schemaConfig?.labelWidth).toBe(
      100
    )

    api.configureSchemx({ schemaConfig: { labelWidth: 200, disabled: true } })
    await wrapper.setProps({ schemaConfig: { readonly: true } })
    await vi.waitFor(() =>
      expect(original.value?.getViewSchemas()[0]).toMatchObject({
        labelWidth: 100,
        disabled: false,
        readonly: true,
      })
    )
    showFresh.value = true
    await nextTick()
    expect(fresh.value?.getViewSchemas()[0]).toMatchObject({
      labelWidth: 200,
      disabled: true,
      readonly: true,
    })
    wrapper.unmount()
  })

  it("组件定义绑定的工厂不向后代传播旧快照", async () => {
    const api = createSchemx({ schemaConfig: { labelWidth: 100 } })

    const Form = scopedForm(api)

    api.rendererRegistry.register("input", Renderer)
    const show = ref(false)

    let form: SchemxInstance<FormValues> | undefined

    const Child = defineComponent({
      setup() {
        form = vueApi.useForm(options, api.createForm)

        return () => h("span")
      },
    })

    const wrapper = mount(Form, {
      props: { ...options, submitter: false, resetter: false },
      slots: { nameLabel: () => (show.value ? h(Child) : h("span")) },
    })

    api.configureSchemx({ schemaConfig: { labelWidth: 200 } })
    show.value = true
    await nextTick()
    expect(form?.getViewSchemas()[0]).toMatchObject({ labelWidth: 200 })
    wrapper.unmount()
  })

  it("scope 自动销毁自身创建的表单，外部表单仍由调用方销毁", () => {
    const api = createSchemx({ schemaConfig: { disabled: true } })

    const Form = scopedForm(api)

    const scope = effectScope()

    const form = scope.run(() => vueApi.useForm(options, api.createForm))

    if (!form) {
      throw new Error("scope did not create a form")
    }

    const destroyed = vi.spyOn(form, "destroy")

    scope.stop()
    expect(destroyed).toHaveBeenCalledOnce()
    api.rendererRegistry.register("input", Renderer)
    const external = createCoreForm({
      ...options,
      rendererRegistry: api.rendererRegistry,
    })

    const externalDestroyed = vi.spyOn(external, "destroy")

    const wrapper = mount(Form, {
      props: { ...options, form: external, submitter: false, resetter: false },
    })

    expect(external.getViewSchemas()[0]).toMatchObject({ disabled: false })
    wrapper.unmount()
    expect(externalDestroyed).not.toHaveBeenCalled()
    external.destroy()
  })
  it("Props 撤销覆盖后回退创建时工厂默认值", async () => {
    const api = createSchemx({ schemaConfig: { labelWidth: 100, disabled: true } })

    api.rendererRegistry.register("input", Renderer)
    const wrapper = mount(scopedForm(api), {
      props: { ...options, labelWidth: 150, submitter: false, resetter: false },
    })

    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
      "width: 150px"
    )
    api.configureSchemx({ schemaConfig: { labelWidth: 200, disabled: false } })
    await wrapper.setProps({ labelWidth: undefined })
    await vi.waitFor(() =>
      expect(wrapper.get(".schemx-field__label").attributes("style")).toContain(
        "width: 100px"
      )
    )
    expect(wrapper.get("input").attributes("disabled")).toBeDefined()
    wrapper.unmount()
  })

  it("组件选项副本保留工厂绑定，嵌套普通 Form 不继承创建器", () => {
    const first = createSchemx({ schemaConfig: { labelWidth: 120 } })

    const second = createSchemx({ schemaConfig: { labelWidth: 240 } })

    first.rendererRegistry.register("input", Renderer)
    second.rendererRegistry.register("input", Renderer)
    const createFirst = vi.spyOn(first, "createForm")

    const createSecond = vi.spyOn(second, "createForm")

    // 模拟组件选项复制，创建器绑定应随可枚举元数据一起保留。
    const First: Component = Object.assign(
      {},
      createFormComponent(first.createForm, "FirstForm")
    )

    const Second: Component = createFormComponent(second.createForm, "SecondForm")

    const firstRef = ref<SchemxInstance<FormValues>>()

    const secondRef = ref<SchemxInstance<FormValues>>()

    const plainRef = ref<SchemxInstance<FormValues>>()

    const props = { ...options, submitter: false, resetter: false }

    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              First,
              { ...props, ref: firstRef },
              {
                nameLabel: () =>
                  h("div", [
                    h(Second, { ...props, ref: secondRef }),
                    h(vueApi.default, { ...props, schemas: [], ref: plainRef }),
                  ]),
              }
            )
        },
      })
    )

    expect(firstRef.value?.getViewSchemas()[0]).toMatchObject({ labelWidth: 120 })
    expect(secondRef.value?.getViewSchemas()[0]).toMatchObject({ labelWidth: 240 })
    expect(plainRef.value).toBeDefined()
    expect(createFirst).toHaveBeenCalledTimes(1)
    expect(createSecond).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
