import { defineComponent, effectScope, h, markRaw, nextTick } from "vue"

import {
  configureSchemx,
  createForm,
  createRendererRegistry,
  getGlobalSchemxConfig,
  isSchemxViewFieldSchema,
  type SchemxConfig,
  type ValidationAdapter,
} from "@schemx/core"
import { mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"

import Schemx from "../form"
import { useForm } from "../hooks/useForm"
import { rendererRegistry as vueRendererRegistry } from "../utils/rendererProvider"

import type { SchemxInstance } from "@schemx/core"

const ConfiguredRenderer = defineComponent({
  name: "ConfiguredRenderer",
  setup() {
    return () => h("input")
  },
})

const RendererPropsProbe = defineComponent({
  name: "RendererPropsProbe",
  props: {
    marker: String,
    shared: String,
  },
  setup(props) {
    return () =>
      h("div", {
        "data-testid": "renderer-props-probe",
        "data-marker": props.marker,
        "data-shared": props.shared,
      })
  },
})

/**
 * 创建用于 App 隔离测试的固定失败 adapter。
 *
 * @param id - adapter 标识。
 * @param message - adapter 产生的错误消息。
 * @returns 可注册到当前 App 的测试 adapter。
 */
function createTestAdapter(id: string, message: string): ValidationAdapter<string> {
  const rules = new WeakSet<object>()

  return {
    id,
    rule(input) {
      const rule = Object.freeze({ adapterId: id, payload: input })

      rules.add(rule)

      return rule
    },
    isRule(value) {
      return typeof value === "object" && value !== null && rules.has(value)
    },
    resolve() {
      return [
        {
          validate: () => ({
            valid: false as const,
            issues: [{ message }],
          }),
        },
      ]
    },
  }
}

afterEach(() => {
  configureSchemx()
})

/**
 * 在独立 Vue 组件实例中创建 Form，并返回用于卸载组件的 wrapper。
 *
 * @param installOptions - 当前 Vue App 的 Schemx 安装配置。
 * @param formOptions - 当前 Form 的显式配置。
 * @returns 已创建的 Form 与组件 wrapper。
 */
function mountUseForm(
  installOptions: Parameters<typeof Schemx.install>[1] = {},
  formOptions: Parameters<typeof useForm>[0] = {}
): { form: SchemxInstance; wrapper: VueWrapper } {
  // 用于从 setup() 捕获当前组件创建的 Form 实例。
  let form: SchemxInstance | undefined

  // 只负责调用 useForm 的测试宿主组件。
  const Host = defineComponent({
    name: "UseFormHost",
    setup() {
      form = useForm(formOptions)

      return () => h("div")
    },
  })

  // 通过 Vue Test Utils 创建真实 App，使插件 provide 可被 useForm 注入。
  const wrapper = mount(Host, {
    global: {
      plugins: [[Schemx, installOptions]],
    },
  })

  if (form === undefined) {
    wrapper.unmount()
    throw new Error("测试宿主未创建 Form 实例")
  }

  return { form, wrapper }
}

describe("Schemx Vue 插件安装", () => {
  it("注册组件并将安装配置限制在当前 App", () => {
    // 模拟 Vue App 的组件注册和 App 级 provide 能力。
    const app = {
      component: vi.fn(),
      provide: vi.fn(),
    }

    const rendererRegistry = createRendererRegistry()

    Schemx.install(app as never, {
      defaultRendererType: "configured",
      rendererRegistry,
      schemaConfig: { readonly: true },
    })

    expect(app.component).toHaveBeenCalledWith("SchemxForm", expect.any(Object))
    expect(app.provide).toHaveBeenCalledWith(
      expect.any(Symbol),
      expect.objectContaining({
        defaultRendererType: "configured",
        rendererRegistry,
        schemaConfig: { readonly: true },
      })
    )
    expect(getGlobalSchemxConfig().rendererRegistry).toBeUndefined()
  })

  it("useForm 使用当前 App 的 Renderer Registry 和 schemaConfig", () => {
    // 当前 App 的 Renderer Registry 与字段默认配置。
    const configuredRegistry = createRendererRegistry()

    configuredRegistry.register("configured", markRaw(ConfiguredRenderer))

    const { form, wrapper } = mountUseForm(
      {
        rendererRegistry: configuredRegistry,
        schemaConfig: { readonly: true },
      },
      {
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "configured",
          },
        ],
      }
    )

    expect(form.getRenderer("configured")).toBe(ConfiguredRenderer)
    expect(form.getViewSchemas()[0]).toMatchObject({ readonly: true })

    wrapper.unmount()
  })

  it("App 安装 Registry 优先于 Vue 模块级 Registry", () => {
    // Vue 包级默认 Registry 中的同级候选项。
    vueRendererRegistry.register("vue-default", markRaw(ConfiguredRenderer))

    // 当前 App 的 Registry 只包含 App 级候选项。
    const appRegistry = createRendererRegistry()

    appRegistry.register("app-default", markRaw(ConfiguredRenderer))

    try {
      const { form, wrapper } = mountUseForm({ rendererRegistry: appRegistry })

      expect(form.hasRenderer("app-default")).toBe(true)
      expect(form.hasRenderer("vue-default")).toBe(false)

      wrapper.unmount()
    } finally {
      vueRendererRegistry.unregister("vue-default")
    }
  })

  it("useForm 的显式配置优先于当前 App 配置", () => {
    // App 级 Renderer Registry。
    const configuredRegistry = createRendererRegistry()

    configuredRegistry.register("configured", markRaw(ConfiguredRenderer))

    // Form 级 Renderer Registry。
    const localRegistry = createRendererRegistry()

    localRegistry.register("local", markRaw(ConfiguredRenderer))

    const { form, wrapper } = mountUseForm(
      { rendererRegistry: configuredRegistry },
      { rendererRegistry: localRegistry }
    )

    expect(form.getRenderer("local")).toBe(ConfiguredRenderer)
    expect(form.hasRenderer("configured")).toBe(false)

    wrapper.unmount()
  })

  it("不同 Vue App 使用彼此隔离的安装 Registry", () => {
    // 第一个 App 的独立 Registry。
    const firstRegistry = createRendererRegistry()

    firstRegistry.register("first", markRaw(ConfiguredRenderer))

    // 第二个 App 的独立 Registry。
    const secondRegistry = createRendererRegistry()

    secondRegistry.register("second", markRaw(ConfiguredRenderer))

    const first = mountUseForm({ rendererRegistry: firstRegistry })

    const second = mountUseForm({ rendererRegistry: secondRegistry })

    expect(first.form.hasRenderer("first")).toBe(true)
    expect(first.form.hasRenderer("second")).toBe(false)
    expect(second.form.hasRenderer("first")).toBe(false)
    expect(second.form.hasRenderer("second")).toBe(true)

    first.wrapper.unmount()
    second.wrapper.unmount()
  })

  it("不同 Vue App 使用彼此隔离的安装 validatorAdapters", async () => {
    const firstAdapter = createTestAdapter("app-isolated-adapter", "第一个 App")

    const secondAdapter = createTestAdapter("app-isolated-adapter", "第二个 App")

    const firstRule = firstAdapter.rule

    const secondRule = secondAdapter.rule

    if (!firstRule || !secondRule) {
      throw new Error("测试 adapter 必须提供 rule")
    }

    const first = mountUseForm(
      { validatorAdapters: [firstAdapter] },
      {
        schemas: [
          {
            name: "email",
            label: "邮箱",
            componentType: "input",
            rules: firstRule("invalid"),
          },
        ],
      }
    )

    const second = mountUseForm(
      { validatorAdapters: [secondAdapter] },
      {
        schemas: [
          {
            name: "email",
            label: "邮箱",
            componentType: "input",
            rules: secondRule("invalid"),
          },
        ],
      }
    )

    const firstResult = await first.form.validate()

    const secondResult = await second.form.validate()

    expect(firstResult.errors[0]?.issues).toEqual([{ message: "第一个 App" }])
    expect(secondResult.errors[0]?.issues).toEqual([{ message: "第二个 App" }])

    first.wrapper.unmount()
    second.wrapper.unmount()
  })

  it("无组件注入上下文时回退到 Vue 模块级 Registry", () => {
    // setup 外的 effect scope 不具备 App 注入上下文。
    const scope = effectScope()

    const registry = createRendererRegistry()

    registry.register("local", markRaw(ConfiguredRenderer))

    const form = scope.run(() => useForm({ rendererRegistry: registry }))

    expect(form?.getRenderer("local")).toBe(ConfiguredRenderer)

    scope.stop()
  })

  it("Vue 表单将 Core 模块级 schemaConfig 作为低优先级基线", () => {
    // Core 模块级配置应在未被 Form 或 App 显式覆盖时生效。
    configureSchemx({ schemaConfig: { readonly: true } })

    const { form, wrapper } = mountUseForm(
      {},
      {
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
          },
        ],
      }
    )

    expect(form.getViewSchemas()[0]).toMatchObject({ readonly: true })

    wrapper.unmount()
  })

  it("按 Core、App、Form、字段优先级浅合并 rendererProps", () => {
    configureSchemx({
      rendererProps: {
        configured: {
          coreOnly: "core",
          shared: "core",
          nested: { source: "core" },
        },
      } as never,
    })

    const { form, wrapper } = mountUseForm(
      {
        rendererProps: {
          configured: {
            appOnly: "app",
            shared: "app",
            nested: { source: "app" },
          },
        } as never,
      },
      {
        rendererProps: {
          configured: {
            formOnly: "form",
            shared: "form",
            nested: { source: "form" },
          },
        } as never,
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "configured",
            componentProps: {
              fieldOnly: "field",
              shared: "field",
            } as never,
          },
        ],
      }
    )

    const fieldSchema = form.getViewSchemas()[0]

    if (!fieldSchema || !isSchemxViewFieldSchema(fieldSchema)) {
      throw new Error("测试字段未生成 Field ViewSchema")
    }

    expect(fieldSchema.componentProps).toMatchObject({
      coreOnly: "core",
      appOnly: "app",
      formOnly: "form",
      fieldOnly: "field",
      shared: "field",
      nested: { source: "form" },
    })

    wrapper.unmount()
  })

  it("App rendererProps 使用只冻结一层的配置快照", () => {
    const nested = { source: "nested" }

    const configuredProps = {
      marker: "app",
      nested,
    }

    const rendererProps = {
      configured: configuredProps,
    }

    const app = {
      component: vi.fn(),
      provide: vi.fn(),
    }

    Schemx.install(app as never, { rendererProps: rendererProps as never })

    const providedConfig = app.provide.mock.calls[0]?.[1] as SchemxConfig

    const normalizedRendererProps = providedConfig.rendererProps as
      Record<string, Record<string, unknown>> | undefined

    const normalizedConfiguredProps = normalizedRendererProps?.configured

    expect(Object.isFrozen(normalizedRendererProps)).toBe(true)
    expect(Object.isFrozen(normalizedConfiguredProps)).toBe(true)
    expect(normalizedRendererProps).not.toBe(rendererProps)
    expect(normalizedConfiguredProps).not.toBe(configuredProps)
    expect(normalizedConfiguredProps?.nested).toBe(nested)

    configuredProps.marker = "mutated"
    ;(rendererProps as Record<string, Record<string, unknown>>).later = {
      marker: "later",
    }

    expect(normalizedConfiguredProps?.marker).toBe("app")
    expect(normalizedRendererProps).not.toHaveProperty("later")
  })

  it("dependencies.componentProps 覆盖 rendererProps 默认值", async () => {
    const { form, wrapper } = mountUseForm(
      {},
      {
        initialValues: { mode: "dynamic" },
        rendererProps: {
          configured: {
            defaultOnly: "default",
            shared: "default",
          },
        } as never,
        schemas: [
          {
            name: "mode",
            label: "模式",
            componentType: "configured",
          },
          {
            name: "target",
            label: "目标",
            componentType: "configured",
            dependencies: {
              triggerFields: ["mode"],
              componentProps: (() => ({
                dynamicOnly: "dynamic",
                shared: "dynamic",
              })) as never,
            },
          },
        ],
      }
    )

    await form.waitForDependencies()

    const target = form
      .getViewSchemas()
      .find((schema) => isSchemxViewFieldSchema(schema) && schema.name === "target")

    if (!target || !isSchemxViewFieldSchema(target)) {
      throw new Error("依赖测试字段未生成 Field ViewSchema")
    }

    expect(target.componentProps).toMatchObject({
      defaultOnly: "default",
      dynamicOnly: "dynamic",
      shared: "dynamic",
    })

    wrapper.unmount()
  })

  it("SchemxForm 将 rendererProps 传给内部创建的 Form", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("probe", markRaw(RendererPropsProbe))

    const wrapper = mount(Schemx, {
      props: {
        rendererRegistry,
        rendererProps: {
          probe: { marker: "component" },
        } as never,
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "probe",
          },
        ],
      },
    })

    await nextTick()

    expect(
      wrapper.get('[data-testid="renderer-props-probe"]').attributes("data-marker")
    ).toBe("component")

    wrapper.unmount()
  })

  it("SchemxForm 不向 external form 追加组件或 App rendererProps", async () => {
    const rendererRegistry = createRendererRegistry()

    const schemas = [
      {
        name: "name",
        label: "姓名",
        componentType: "probe",
      },
    ]

    rendererRegistry.register("probe", markRaw(RendererPropsProbe))

    const externalForm = createForm({
      rendererRegistry,
      rendererProps: {
        probe: { marker: "external" },
      } as never,
      schemas,
    })

    const wrapper = mount(Schemx, {
      props: {
        form: externalForm,
        rendererProps: {
          probe: { marker: "component" },
        } as never,
        schemas,
      },
      global: {
        plugins: [
          [
            Schemx,
            {
              rendererProps: {
                probe: { marker: "app" },
              } as never,
            },
          ],
        ],
      },
    })

    await nextTick()

    expect(
      wrapper.get('[data-testid="renderer-props-probe"]').attributes("data-marker")
    ).toBe("external")

    wrapper.unmount()
    externalForm.destroy()
  })
})
