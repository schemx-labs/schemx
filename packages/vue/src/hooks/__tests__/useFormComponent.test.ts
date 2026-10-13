/**
 * Form 接入的配置边界及创建参数测试，不依赖主组件的 SFC 编译。
 *
 * @module hooks/__tests__/useFormComponent
 */

import { defineComponent, h, markRaw, nextTick, shallowReactive } from "vue"
import type { App, Component } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import ConfigProvider from "../../components/ConfigProvider"
import { provideSchemxAppConfig } from "../../context/configProviderContext"
import { useOptionalFormContextValue } from "../../context/formContext"
import { useFormComponent } from "../useFormComponent"

import type { FormContextValue } from "../../context/formContext"
import type { SchemxFormProps } from "../../types/form"
import type { FormComponentRuntime } from "../useFormComponent"
import type { CreateSchemxOptions } from "@schemx/core"
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
      runtime = useFormComponent<FormValues>(props, () => {})

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
        iconComponent: appComponent,
      },
      config: {
        colComponent: providerComponent,
        rowComponent: providerComponent,
        iconComponent: providerComponent,
      },
      props: {
        colComponent: formComponent,
        rowComponent: formComponent,
        iconComponent: formComponent,
      },
    })

    for (const key of ["colComponent", "rowComponent", "iconComponent"] as const) {
      expect(result.context[key]).toBe(formComponent)
      result.props[key] = undefined
    }

    await nextTick()

    for (const key of ["colComponent", "rowComponent", "iconComponent"] as const) {
      expect(result.context[key]).toBe(providerComponent)
    }

    await result.wrapper.setProps({
      colComponent: undefined,
      rowComponent: undefined,
      iconComponent: undefined,
    })

    for (const key of ["colComponent", "rowComponent", "iconComponent"] as const) {
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
