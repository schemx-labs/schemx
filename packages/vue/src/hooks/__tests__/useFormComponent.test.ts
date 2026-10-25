/**
 * Form 接入的配置边界及创建参数测试，不依赖主组件的 SFC 编译。
 *
 * @module hooks/__tests__/useFormComponent
 */

import { defineComponent, h, markRaw, nextTick, reactive, shallowReactive } from "vue"
import type { App, Component } from "vue"

import { createForm, createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import { useFormComponent } from ".."
import ConfigProvider from "../../components/ConfigProvider"
import { provideSchemxAppConfig, useOptionalFormContextValue } from "../../context"
import { createSchemx } from "../../createSchemx"

import type { FormComponentRuntime } from ".."
import type { FormContextValue } from "../../context"
import type { SchemxFormProps } from "../../types"
import type { CreateSchemxOptions, SchemxApi } from "@schemx/core"
import type { VueWrapper } from "@vue/test-utils"

// 测试表单使用一个字符串字段。
interface FormValues {
  name: string
}

// 与主组件补齐默认值后的接入参数保持一致。
type TestFormProps = SchemxFormProps<FormValues> &
  Required<Pick<SchemxFormProps<FormValues>, "modelValue" | "initialValues" | "schemas">>

// 分别配置 App、Provider 和当前组件的输入。
interface MountFormOptions {
  appConfig?: CreateSchemxOptions
  config?: CreateSchemxOptions
  props?: SchemxFormProps<FormValues>
  // 可选工厂用于验证创建时继承快照。
  creator?: SchemxApi["createForm"]
}

// 暴露接入结果及响应式 Props，供测试验证配置覆盖和实例所有权。
interface MountedForm {
  wrapper: VueWrapper
  props: TestFormProps
  runtime: FormComponentRuntime<FormValues>
  context: FormContextValue<FormValues>
}

/**
 * 在真实组件 scope 中建立 Form 与子级 Context。
 * @param options - App、Provider 和组件级配置。
 * @returns 可卸载的宿主及已建立的 Form 接入结果。
 */
function mountForm(options: MountFormOptions = {}): MountedForm {
  // 模拟主组件的默认模型；空对象表示未提供受控值。
  const props = shallowReactive<TestFormProps>({
    modelValue: {} as FormValues,
    initialValues: { name: "Ada" },
    schemas: [{ name: "name", label: "Name", componentType: "input" }],
    ...options.props,
  })

  // 在 setup 中捕获接入结果和后代消费的 Context。
  let runtime: FormComponentRuntime<FormValues> | undefined

  let context: FormContextValue<FormValues> | undefined

  // 使用真正的注入路径读取组件实现及 Schema 默认配置。
  const Child = defineComponent({
    setup() {
      context = useOptionalFormContextValue<FormValues>()

      return () => h("div")
    },
  })

  // 直接接入 Hook，使测试不受主组件 SFC 编译问题影响。
  const Host = defineComponent({
    setup() {
      runtime = useFormComponent<FormValues>(props, () => {}, options.creator)

      return () => h(Child)
    },
  })

  // 在 App 安装阶段提供最低层的共享配置。
  const plugin = {
    /**
     * 安装测试 App 的配置。
     * @param app - 测试宿主所属的 Vue App。
     */
    install(app: App): void {
      provideSchemxAppConfig(app, options.appConfig)
    },
  }

  // Provider 为 Host 提供组件树级配置。
  const wrapper = mount(ConfigProvider, {
    props: options.config,
    slots: { default: () => h(Host) },
    global: { plugins: [plugin] },
  })

  if (!runtime || !context) {
    wrapper.unmount()
    throw new Error("Form 测试上下文未建立")
  }

  return { wrapper, props, runtime, context }
}

/**
 * 创建可按引用比较的测试组件实现。
 * @param name - 用于辨识配置来源的组件名称。
 * @returns 不参与深度响应式转换的组件。
 */
function createComponent(name: string): Component {
  return markRaw(defineComponent({ name, setup: () => () => h("div") }))
}

// 使用原生规则抛出异常，验证 onRuleError 的真实调用路径。
const failingSchemas: NonNullable<SchemxFormProps<FormValues>["schemas"]> = [
  {
    name: "name",
    label: "Name",
    componentType: "input",
    rules: [
      {
        validate() {
          throw new Error("rule failure")
        },
      },
    ],
  },
]

describe("useFormComponent", () => {
  it("Renderer Props 支持响应式覆盖与撤销，按 Form、Provider、App 顺序回退", async () => {
    const result = mountForm({
      appConfig: { rendererProps: { input: { placeholder: "App" } } },
      config: { rendererProps: { input: { placeholder: "Provider" } } },
      props: { rendererProps: { input: { placeholder: "Form" } } },
    })

    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "Form" },
    })
    result.props.rendererProps = { input: { placeholder: "Updated" } }
    await nextTick()
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "Updated" },
    })
    result.props.rendererProps = undefined
    await nextTick()
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "Provider" },
    })
    await result.wrapper.setProps({
      rendererProps: { input: { placeholder: "New provider" } },
    })
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "New provider" },
    })
    await result.wrapper.setProps({ rendererProps: undefined })
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "App" },
    })

    result.wrapper.unmount()
  })

  it("Schema 与 Renderer Props 在一次更新内成批提交，保留字段状态", async () => {
    const result = mountForm({
      props: { rendererProps: { input: { placeholder: "Before" } } },
    })

    const form = result.runtime.form

    form.setFieldErrors("name", ["外部错误"])
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true)
    const values = form.state.values.value

    const submit = vi.spyOn(form, "setConfig")

    const configChanges = vi.fn()

    const stop = form.state.config.subscribe(configChanges)

    configChanges.mockClear()
    result.props.labelWidth = 180
    result.props.labelAlign = "left"
    result.props.rendererProps = { input: { placeholder: "After" } }
    await nextTick()

    expect(submit).toHaveBeenCalledTimes(1)
    expect(configChanges).toHaveBeenCalledTimes(1)
    expect(form.getViewSchemas()[0]).toMatchObject({
      labelWidth: 180,
      labelAlign: "left",
      componentProps: { placeholder: "After" },
    })
    expect(form.state.values.value).toBe(values)
    expect(form.getFieldErrors("name")).toEqual(["外部错误"])
    expect(form.isFieldTouched("name")).toBe(true)
    expect(form.isFieldPending("name")).toBe(true)

    stop()
    result.wrapper.unmount()
  })

  it("Renderer Props 的原地修改也提交，并回退到创建时工厂快照", async () => {
    const api = createSchemx({ rendererProps: { input: { placeholder: "Factory" } } })

    const rendererProps = reactive({ input: { placeholder: "Local" } })

    const result = mountForm({ creator: api.createForm, props: { rendererProps } })

    rendererProps.input.placeholder = "Mutated"
    await nextTick()
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "Mutated" },
    })
    api.configureSchemx({ rendererProps: { input: { placeholder: "Future factory" } } })
    result.props.rendererProps = undefined
    await nextTick()
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "Factory" },
    })

    result.wrapper.unmount()
  })

  it("创建选项的后续 Props 变化不会替换引擎或重新提交消费配置", async () => {
    const original = createRendererRegistry()

    const result = mountForm({ props: { rendererRegistry: original, debug: false } })

    const submit = vi.spyOn(result.runtime.form, "setConfig")

    const view = result.runtime.form.getViewSchemas()[0]

    result.props.rendererRegistry = createRendererRegistry()
    result.props.debug = true
    await nextTick()

    expect(submit).not.toHaveBeenCalled()
    expect(result.runtime.config.value.rendererRegistry).toBe(original)
    expect(result.runtime.config.value.debug).toBe(false)
    expect(result.runtime.form.getViewSchemas()[0]).toBe(view)

    result.wrapper.unmount()
  })

  it("外部 Form 在同一批内修改对象和撤销标量配置时只发布一次配置", async () => {
    const external = createForm<FormValues>({ initialValues: { name: "External" } })

    const col = reactive({ span: 12 })

    const result = mountForm({ props: { form: external, readonly: false, col } })

    const changes = vi.fn()

    const stop = external.state.config.subscribe(changes)

    changes.mockClear()
    col.span = 8
    result.props.readonly = undefined
    await nextTick()

    expect(changes).toHaveBeenCalledTimes(1)
    expect(external.state.config.value.schemaConfig.col).toEqual({ span: 8 })
    expect(external.getFieldsValue()).toEqual({ name: "External" })

    stop()
    result.wrapper.unmount()
    external.destroy()
  })

  it("从嵌套配置继承布局，保留 Provider 高于 App 的优先级", () => {
    const result = mountForm({
      appConfig: { schemaConfig: { col: { span: 12 }, row: { gutter: 4 } } },
      config: { schemaConfig: { col: { span: 8 }, row: { justify: "center" } } },
    })

    expect(result.context.schemaConfig.col).toEqual({ span: 8 })
    expect(result.context.schemaConfig.row).toEqual({ justify: "center" })
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({ col: { span: 8 } })
    result.wrapper.unmount()
  })

  it("Form 平铺布局覆盖共享配置，撤销后恢复继承值", async () => {
    const result = mountForm({
      config: { schemaConfig: { col: { span: 8 }, row: { gutter: 12 } } },
      props: { col: { span: 6 }, row: { gutter: 4 } },
    })

    expect(result.context.schemaConfig.col).toEqual({ span: 6 })
    expect(result.context.schemaConfig.row).toEqual({ gutter: 4 })
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({ col: { span: 6 } })

    result.props.col = undefined
    result.props.row = undefined
    await nextTick()

    expect(result.context.schemaConfig.col).toEqual({ span: 8 })
    expect(result.context.schemaConfig.row).toEqual({ gutter: 12 })
    expect(result.runtime.form.getViewSchemas()[0]).toMatchObject({ col: { span: 8 } })
    result.wrapper.unmount()
  })

  it("顶层组件实现按 Form、Provider、App 的顺序解析", async () => {
    const appComponent = createComponent("AppComponent")

    const providerComponent = createComponent("ProviderComponent")

    const formComponent = createComponent("FormComponent")

    const result = mountForm({
      appConfig: {
        colComponent: appComponent,
        rowComponent: appComponent,
        buttonComponent: appComponent,
        iconComponent: appComponent,
      },
      config: {
        colComponent: providerComponent,
        rowComponent: providerComponent,
        buttonComponent: providerComponent,
        iconComponent: providerComponent,
      },
      props: {
        colComponent: formComponent,
        rowComponent: formComponent,
        buttonComponent: formComponent,
        iconComponent: formComponent,
      },
    })

    for (const key of [
      "colComponent",
      "rowComponent",
      "buttonComponent",
      "iconComponent",
    ] as const) {
      expect(result.context[key]).toBe(formComponent)
      result.props[key] = undefined
    }

    await nextTick()

    for (const key of [
      "colComponent",
      "rowComponent",
      "buttonComponent",
      "iconComponent",
    ] as const) {
      expect(result.context[key]).toBe(providerComponent)
    }

    await result.wrapper.setProps({
      colComponent: undefined,
      rowComponent: undefined,
      buttonComponent: undefined,
      iconComponent: undefined,
    })

    for (const key of [
      "colComponent",
      "rowComponent",
      "buttonComponent",
      "iconComponent",
    ] as const) {
      expect(result.context[key]).toBe(appComponent)
    }

    result.wrapper.unmount()
  })

  it("内部 Form 接收规则错误处理器和挂载、卸载 Hook", async () => {
    const onRuleError = vi.fn(() => "自定义规则错误")

    const mounted = vi.fn()

    const unmounted = vi.fn()

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const result = mountForm({
      props: {
        schemas: failingSchemas,
        onRuleError,
        lifecycleHooks: { mounted, unmounted },
      },
    })

    try {
      expect(mounted).toHaveBeenCalled()
      expect(await result.runtime.form.validate()).toMatchObject({
        valid: false,
        errors: [{ issues: [{ message: "自定义规则错误" }] }],
      })
      expect(onRuleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ name: "name" })
      )
    } finally {
      result.wrapper.unmount()
      log.mockRestore()
    }

    expect(unmounted).toHaveBeenCalled()
  })

  it("保留默认规则错误消息及生命周期异常隔离", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const result = mountForm({
      props: {
        schemas: failingSchemas,
        lifecycleHooks: {
          mounted() {
            throw new Error("mount failure")
          },
          unmounted() {
            throw new Error("unmount failure")
          },
        },
      },
    })

    try {
      expect(result.runtime.form.getFieldValue("name")).toBe("Ada")
      expect(await result.runtime.form.validate()).toMatchObject({
        valid: false,
        errors: [{ issues: [{ message: "校验执行失败" }] }],
      })
    } finally {
      expect(() => result.wrapper.unmount()).not.toThrow()
      log.mockRestore()
    }
  })

  it("外部 Form 保留原回调、生命周期、字段配置及所有权", async () => {
    const externalOnRuleError = vi.fn(() => "外部规则错误")

    const externalUnmounted = vi.fn()

    const onRuleError = vi.fn(() => "组件规则错误")

    const mounted = vi.fn()

    const unmounted = vi.fn()

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const external = createForm<FormValues>({
      schemas: failingSchemas,
      initialValues: { name: "external" },
      schemaConfig: { col: { span: 12 } },
      onRuleError: externalOnRuleError,
      lifecycleHooks: { unmounted: externalUnmounted },
    })

    const destroy = vi.spyOn(external, "destroy")

    const result = mountForm({
      config: { schemaConfig: { col: { span: 8 }, readonly: true } },
      props: {
        form: external,
        schemas: failingSchemas,
        onRuleError,
        lifecycleHooks: { mounted, unmounted },
      },
    })

    try {
      expect(result.runtime.form.getFieldValue("name")).toBe("external")
      expect(external.getViewSchemas()[0]).toMatchObject({
        col: { span: 12 },
        readonly: false,
      })
      expect(await result.runtime.form.validate()).toMatchObject({
        valid: false,
        errors: [{ issues: [{ message: "外部规则错误" }] }],
      })
      expect(externalOnRuleError).toHaveBeenCalled()
      expect(onRuleError).not.toHaveBeenCalled()
    } finally {
      result.wrapper.unmount()
      expect(destroy).not.toHaveBeenCalled()
      expect(mounted).not.toHaveBeenCalled()
      expect(unmounted).not.toHaveBeenCalled()
      expect(externalUnmounted).not.toHaveBeenCalled()
      external.destroy()
      log.mockRestore()
    }

    expect(externalUnmounted).toHaveBeenCalled()
  })
})
