import { describe, expect, it, vi } from "vite-plus/test"

import { getFormStateAdapterContext } from "../adapter/formStateAdapter/context"
import { createFormConfig } from "../config/createFormConfig"
import { createForm, createSchemas, createSchemx, mergeConfig } from "../index"

import type { FormConfig, SchemxInstance, ValidationTrigger, Values } from "../index"

// 配置扩展仍沿用 Core 的声明合并，不依赖框架类型。
declare module "../index" {
  interface SchemxConfigDefinition {
    consumerTheme?: string
    consumerAction?: { text: string }
  }
  interface SchemxSchemaConfigDefinition {
    consumerMeta?: string
  }
  interface SchemxComponentPropsDefinition<TValues extends Values = Values> {
    consumerOption?: string
    consumerMetadata?: { text: string; values?: TValues }
  }
}

/**
 * 创建已固定 UI 默认值的工厂，消费配置始终作为独立输入。
 */
function createTestForm() {
  const api = createSchemx({
    schemaConfig: { labelWidth: 140, disabled: true },
    rendererProps: { input: { placeholder: "ui" } },
  })

  return api.createForm({
    initialValues: { name: "Ada", fixed: "", extra: "" },
    schemaConfig: { disabled: false },
    schemas: [
      { name: "name", label: "姓名", componentType: "input" },
      {
        name: "fixed",
        label: "固定",
        componentType: "input",
        readonly: true,
        componentProps: { placeholder: "field" },
      },
      { name: "extra", label: "扩展", componentType: "custom" },
    ],
  })
}

describe("固定库默认值与消费配置", () => {
  it("创建时捕获输入一次，撤销消费配置保留实际选定的引擎选项", () => {
    let inheritedReads = 0

    let consumerReads = 0

    const configuration = createFormConfig({
      defaults: {
        debug: false,
        schemaConfig: {
          get disabled() {
            inheritedReads++

            return true
          },
        },
      },
      config: {
        debug: true,
        validationConcurrency: 2,
        schedulerOptions: { timeSliceMs: 3 },
        schemaConfig: {
          get disabled() {
            consumerReads++

            return false
          },
        },
      },
    })

    const initial = configuration.getConfig()

    expect(initial.schemaConfig.disabled).toBe(false)
    expect(inheritedReads).toBe(1)
    expect(consumerReads).toBe(1)
    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(initial.schemaConfig)).toBe(true)
    expect(Object.isFrozen(initial.schedulerOptions)).toBe(true)
    expect(Object.isFrozen(initial.validatorAdapters)).toBe(true)
    configuration.setConfig({})
    const next = configuration.getConfig()

    expect(next.schemaConfig.disabled).toBe(true)
    expect(next.debug).toBe(true)
    expect(next.validationConcurrency).toBe(2)
    expect(next.schedulerOptions).toBe(initial.schedulerOptions)
    expect(next.rendererRegistry).toBe(initial.rendererRegistry)
    expect(next.presetRuleRegistry).toBe(initial.presetRuleRegistry)
    expect(next.validatorAdapters).toBe(initial.validatorAdapters)
    expect(inheritedReads).toBe(1)
    expect(consumerReads).toBe(1)
    configuration.dispose()
  })

  it("顶层配置 getter 在捕获继承输入和消费更新时各读取一次", () => {
    // 统计原始输入的顶层求值次数，快照合并不应重新访问它们。
    let schemaReads = 0

    let rendererReads = 0

    let adapterReads = 0

    // 每次 getter 都返回新容器，避免依赖稳定引用掩盖重复读取。
    const input = {
      get schemaConfig() {
        schemaReads++

        return { disabled: true }
      },
      get rendererProps() {
        rendererReads++

        return { input: { placeholder: "captured" } }
      },
      get validatorAdapters() {
        adapterReads++

        return []
      },
    }

    // 继承输入与消费输入使用相同的捕获规则。
    const configuration = createFormConfig({ defaults: input })

    expect([schemaReads, rendererReads, adapterReads]).toEqual([1, 1, 1])
    configuration.setConfig({
      get schemaConfig() {
        return input.schemaConfig
      },
      get rendererProps() {
        return input.rendererProps
      },
    })
    expect([schemaReads, rendererReads, adapterReads]).toEqual([2, 2, 1])
    expect(configuration.getConfig()).toMatchObject({
      schemaConfig: { disabled: true },
      rendererProps: { input: { placeholder: "captured" } },
    })
    configuration.dispose()
  })

  it("继承输入在创建后修改不影响撤销时的回退值", () => {
    const defaults = {
      schemaConfig: { disabled: true },
      rendererProps: { input: { placeholder: "inherited" } },
    }

    const configuration = createFormConfig({
      defaults,
      config: { schemaConfig: { disabled: false } },
    })

    defaults.schemaConfig.disabled = false
    defaults.rendererProps.input.placeholder = "changed"
    configuration.setConfig({})
    expect(configuration.getConfig().schemaConfig.disabled).toBe(true)
    expect(configuration.getConfig().rendererProps?.input?.placeholder).toBe("inherited")
    expect(Object.isFrozen(defaults)).toBe(false)
    expect(Object.isFrozen(defaults.schemaConfig)).toBe(false)
    configuration.dispose()
  })

  it("Core、框架、UI 逐级合并并固定，消费配置始终最高优先级", () => {
    const core = { schemaConfig: { readonly: false, labelWidth: 80 } }

    const framework = mergeConfig(
      {
        schemaConfig: { labelWidth: 100 },
        rendererProps: { input: { placeholder: "framework" } },
      },
      core
    )

    const ui = mergeConfig(
      {
        schemaConfig: { labelWidth: 140, disabled: true },
        rendererProps: { input: { placeholder: "ui" } },
      },
      framework
    )

    const api = createSchemx(ui)

    const form = api.createForm({
      initialValues: { name: "Ada" },
      schemaConfig: { disabled: false, labelWidth: 200 },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      readonly: false,
      disabled: false,
      labelWidth: 200,
      visible: true,
    })
    expect(form.getViewSchemas()[0]).toMatchObject({
      disabled: false,
      labelWidth: 200,
      componentProps: { placeholder: "ui" },
    })
    form.setConfig({})
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      readonly: false,
      disabled: true,
      labelWidth: 140,
    })
    expect(form.getViewSchemas()[0]).toMatchObject({ disabled: true, labelWidth: 140 })
    expect(api.getConfig()).toMatchObject(ui)
    form.destroy()
  })

  it("消费配置在首帧即生效，撤销后恢复独立的库默认值", () => {
    const form = createTestForm()

    const field = form.getFieldState(form.getFieldRef("name"))

    const id = form.getViewSchemas()[0].nodeId

    expect(form.getViewSchemas()[0]).toMatchObject({ disabled: false, labelWidth: 140 })
    form.setConfig({ schemaConfig: { labelWidth: 220 } })
    expect(form.getViewSchemas()[0]).toMatchObject({ disabled: true, labelWidth: 220 })
    expect(form.getFieldValue("name")).toBe("Ada")
    expect(form.getFieldState(form.getFieldRef("name"))).toBe(field)
    expect(form.getViewSchemas()[0].nodeId).toBe(id)
    form.setConfig({})
    expect(form.getViewSchemas()[0]).toMatchObject({ disabled: true, labelWidth: 140 })
    form.destroy()
  })

  it("局部更新保留其他消费属性，完整替换可以撤销消费覆盖", () => {
    const form = createTestForm()

    form.setConfig({ schemaConfig: { readonly: false, labelWidth: 200 } })
    form.updateSchemaConfig({ readonly: true, disabled: false })
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      readonly: true,
      disabled: false,
      labelWidth: 200,
    })
    form.setConfig({ schemaConfig: { readonly: false } })
    expect(form.getViewSchemas()[0]).toMatchObject({
      readonly: false,
      disabled: true,
      labelWidth: 140,
    })
    expect(form.getViewSchemas()[1]).toMatchObject({ readonly: true })
    form.destroy()
  })

  it("显式 undefined 保留旧的 Core 默认值语义，未提供属性继承固定 UI 默认值", () => {
    const form = createTestForm()

    form.updateSchemaConfig({ disabled: undefined, labelWidth: undefined })
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      disabled: false,
      labelWidth: "auto",
    })
    form.setConfig({})
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      disabled: true,
      labelWidth: 140,
    })
    form.destroy()
  })

  it("工厂之后的修改只影响新表单，不改变已有表单的固定默认值", () => {
    const api = createSchemx({ schemaConfig: { labelWidth: 140, readonly: true } })

    const form = api.createForm({
      initialValues: { name: "" },
      schemaConfig: { readonly: false },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    api.configureSchemx({ schemaConfig: { labelWidth: 300, readonly: false } })
    form.setConfig({})
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).toMatchObject({
      labelWidth: 140,
      readonly: true,
    })
    expect(form.getViewSchemas()[0]).toMatchObject({ labelWidth: 140, readonly: true })
    const next = api.createForm({})

    expect(
      getFormStateAdapterContext(next).configuration.state.value.schemaConfig
    ).toMatchObject({
      labelWidth: 300,
      readonly: false,
    })
    next.destroy()
    form.destroy()
  })

  it("Renderer 默认 Props 可以更新和撤销，字段显式 Props 仍然优先", () => {
    const form = createTestForm()

    form.setConfig({
      rendererProps: {
        input: { placeholder: "consumer", consumerOption: "active" },
        custom: { consumerOption: "temporary" },
      },
    })
    expect(form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "consumer", consumerOption: "active" },
    })
    expect(form.getViewSchemas()[1]).toMatchObject({
      componentProps: { placeholder: "field", consumerOption: "active" },
    })
    expect(form.getViewSchemas()[2]).toMatchObject({
      componentProps: { consumerOption: "temporary" },
    })
    form.setConfig({})
    expect(form.getViewSchemas()[0]).toMatchObject({
      componentProps: { placeholder: "ui" },
    })
    expect(form.getViewSchemas()[0]).not.toMatchObject({
      componentProps: { consumerOption: "active" },
    })
    expect(form.getViewSchemas()[2]).not.toMatchObject({
      componentProps: { consumerOption: "temporary" },
    })
    form.destroy()
  })

  it("撤销 Schema 扩展属性时同步清理 Runtime 中的旧值", () => {
    const form = createTestForm()

    form.setConfig({ schemaConfig: { consumerMeta: "active" } })
    expect(form.getViewSchemas()[0]).toMatchObject({ consumerMeta: "active" })
    form.setConfig({})
    expect(
      getFormStateAdapterContext(form).configuration.state.value.schemaConfig
    ).not.toHaveProperty("consumerMeta")
    expect(form.getViewSchemas()[0]).not.toHaveProperty("consumerMeta")
    form.destroy()
  })

  it("订阅只看到已更新的视图，批量修改只发布最终结果", () => {
    const form = createTestForm()

    const seen: Array<{ config: boolean | undefined; view: boolean | undefined }> = []

    getFormStateAdapterContext(form).configuration.state.subscribe((config) =>
      seen.push({
        config: config.schemaConfig.readonly,
        view: form.getViewSchemas()[0].readonly,
      })
    )
    form.batch(() => {
      form.setConfig({ schemaConfig: { readonly: true } })
      form.setConfig({ schemaConfig: { readonly: false } })
    })
    expect(seen).toEqual([
      { config: false, view: false },
      { config: false, view: false },
    ])
    form.destroy()
  })

  it("等价 Renderer Props 不重新发布配置，属性变化时才提交编译", () => {
    const configuration = createFormConfig({
      config: { rendererProps: { input: { placeholder: "initial" } } },
    })

    const initial = configuration.getConfig()

    const changed = vi.fn()

    const apply = vi.fn()

    configuration.state.subscribe(changed)
    configuration.setConfig(
      { rendererProps: { input: { placeholder: "initial" } } },
      apply
    )
    expect(configuration.getConfig()).toBe(initial)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(apply).not.toHaveBeenCalled()
    configuration.setConfig(
      { rendererProps: { input: { placeholder: "changed" } } },
      apply
    )
    expect(configuration.getConfig().rendererProps?.input?.placeholder).toBe("changed")
    expect(changed).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenCalledTimes(1)
    configuration.dispose()
  })

  it("等价标量配置保持状态与视图引用稳定", () => {
    const form = createTestForm()

    const initial = getFormStateAdapterContext(form).configuration.state.value

    const view = form.getViewSchemas()

    const changed = vi.fn()

    getFormStateAdapterContext(form).configuration.state.subscribe(changed)
    form.setConfig({ schemaConfig: { disabled: false } })
    form.updateSchemaConfig({ disabled: false })
    form.updateSchemaConfig({})
    expect(getFormStateAdapterContext(form).configuration.state.value).toBe(initial)
    expect(form.getViewSchemas()).toBe(view)
    expect(changed).toHaveBeenCalledTimes(1)
    form.destroy()
  })

  it("隔离并冻结受管输入，原对象可以继续作为后续消费配置", () => {
    const form = createTestForm()

    const input = {
      schemaConfig: { disabled: false },
      rendererProps: { input: { placeholder: "first" } },
    }

    form.setConfig(input)
    const initial = getFormStateAdapterContext(form).configuration.state.value

    input.schemaConfig.disabled = true
    input.rendererProps.input.placeholder = "second"
    expect(initial.schemaConfig.disabled).toBe(false)
    expect(initial.rendererProps).toMatchObject({ input: { placeholder: "first" } })
    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(initial.schemaConfig)).toBe(true)
    expect(Object.isFrozen(initial.rendererProps?.input)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    form.setConfig(input)
    expect(form.getViewSchemas()[0]).toMatchObject({
      disabled: true,
      componentProps: { placeholder: "second" },
    })
    form.destroy()
  })

  it("同引用数组和 Renderer 嵌套对象重提后仍刷新编译", () => {
    const form = createTestForm()

    const triggers: ValidationTrigger[] = ["blur"]

    form.setConfig({ schemaConfig: { validationTrigger: triggers } })
    let previous = form.getViewSchemas()

    triggers.push("change")
    form.updateSchemaConfig({ validationTrigger: triggers })
    expect(form.getViewSchemas()).not.toBe(previous)
    expect(form.getViewSchemas()[0]).toMatchObject({
      validationTrigger: ["blur", "change"],
    })
    const metadata = { text: "first" }

    const input = { rendererProps: { input: { consumerMetadata: metadata } } }

    form.setConfig(input)
    previous = form.getViewSchemas()
    metadata.text = "second"
    form.setConfig(input)
    expect(form.getViewSchemas()).not.toBe(previous)
    expect(form.getViewSchemas()[0]).toMatchObject({
      componentProps: { consumerMetadata: { text: "second" } },
    })
    form.destroy()
  })

  it("消费配置属性只求值一次，比较使用捕获的结果", () => {
    const configuration = createFormConfig()

    let reads = 0

    configuration.setConfig({
      schemaConfig: {
        get readonly() {
          reads++

          return true
        },
      },
    })
    expect(reads).toBe(1)
    expect(configuration.state.value.schemaConfig.readonly).toBe(true)
    configuration.dispose()
  })

  it("编译提交失败不发布配置，重试和局部更新均先提交再通知", () => {
    const configuration = createFormConfig()

    const previous = configuration.getConfig()

    const published: boolean[] = []

    let applied = false

    configuration.state.subscribe(() => published.push(applied))
    const error = new Error("apply failed")

    expect(() =>
      configuration.setConfig({ schemaConfig: { readonly: true } }, () => {
        expect(configuration.getConfig()).toBe(previous)
        throw error
      })
    ).toThrow(error)
    expect(configuration.getConfig()).toBe(previous)
    expect(published).toEqual([false])
    configuration.setConfig({ schemaConfig: { readonly: true } }, () => {
      applied = true
    })
    expect(published).toEqual([false, true])
    applied = false
    configuration.updateSchemaConfig({ readonly: false }, () => {
      applied = true
    })
    expect(published).toEqual([false, true, true])
    configuration.dispose()
  })

  it("编译失败恢复 Runtime 配置，撤销和后续 Schema 更新不泄漏失败值", () => {
    // 只在配置重编译阶段触发错误。
    let fail = false

    // 保留同一 Schema 引用，使刷新确实经过编译缓存失效路径。
    const schemas = createSchemas([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
        get componentProps() {
          if (fail) {
            throw new Error("compile failed")
          }

          return {}
        },
      },
    ])

    // 初始配置与失败候选同时覆盖 Schema 默认值和 Renderer Props。
    const form = createForm({
      initialValues: { name: "" },
      schemas,
      schemaConfig: { disabled: false },
      rendererProps: { input: { placeholder: "initial" } },
    })

    const configuration = getFormStateAdapterContext(form).configuration

    const previous = configuration.getConfig()

    fail = true
    expect(() =>
      form.setConfig({
        schemaConfig: { disabled: true },
        rendererProps: { input: { placeholder: "failed" } },
      })
    ).toThrow("compile failed")
    expect(configuration.getConfig()).toBe(previous)
    fail = false
    form.setConfig({
      schemaConfig: { disabled: false },
      rendererProps: { input: { placeholder: "initial" } },
    })
    schemas.set([...schemas.value])
    expect(configuration.getConfig()).toBe(previous)
    expect(form.getViewSchemas()[0]).toMatchObject({
      disabled: false,
      componentProps: { placeholder: "initial" },
    })
    form.updateSchemaConfig({ readonly: true })
    expect(form.getViewSchemas()[0]).toMatchObject({
      readonly: true,
      disabled: false,
      componentProps: { placeholder: "initial" },
    })
    form.destroy()
  })

  it("已生成子树编译失败时不提前应用根节点配置", async () => {
    // 首次生成成功后，只让配置刷新时的子字段编译失败。
    let fail = false

    const form = createForm({
      initialValues: { name: "", extra: "" },
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
        {
          to: ["name"],
          renderer: () => [
            {
              name: "extra",
              label: "扩展",
              componentType: "input",
              get componentProps() {
                if (fail) {
                  throw new Error("generated compile failed")
                }

                return {}
              },
            },
          ],
        },
      ],
    })

    await form.waitForDependencies()

    // 根节点和动态字段都必须保留上一次提交的状态。
    const previous = form.getViewSchemas()

    const configuration = getFormStateAdapterContext(form).configuration

    fail = true
    expect(() => form.setConfig({ schemaConfig: { disabled: true } })).toThrow(
      "generated compile failed"
    )
    expect(configuration.getConfig().schemaConfig.disabled).toBe(false)
    expect(form.getViewSchemas()).toBe(previous)
    fail = false
    form.updateSchemaConfig({ readonly: true })
    expect(form.getViewSchemas()).toMatchObject([
      { name: "name", readonly: true, disabled: false },
      { name: "extra", readonly: true, disabled: false },
    ])
    form.destroy()
  })

  it("仅更新展示扩展时不重新编译 Schema", () => {
    const apply = vi.fn()

    const configuration = createFormConfig()

    configuration.setConfig({ consumerTheme: "dark" }, apply)
    expect(configuration.state.value.consumerTheme).toBe("dark")
    expect(apply).not.toHaveBeenCalled()
    configuration.setConfig({}, apply)
    expect(configuration.state.value.consumerTheme).toBeUndefined()
    expect(apply).not.toHaveBeenCalled()
    configuration.dispose()
  })

  it("消费展示对象原地修改后重提也会通知，且不重编译字段", () => {
    const apply = vi.fn()

    const configuration = createFormConfig()

    const action = { text: "first" }

    configuration.setConfig({ consumerAction: action }, apply)
    const changed = vi.fn()

    configuration.state.subscribe(changed)
    action.text = "second"
    configuration.setConfig({ consumerAction: action }, apply)
    expect(changed).toHaveBeenCalledTimes(2)
    expect(configuration.state.value.consumerAction?.text).toBe("second")
    expect(apply).not.toHaveBeenCalled()
    configuration.dispose()
  })

  it.each([
    "rendererRegistry",
    "presetRuleRegistry",
    "validatorAdapters",
    "defaultRendererType",
    "debug",
    "schedulerOptions",
    "validationConcurrency",
  ])("运行期不替换创建选项 %s", (key) => {
    const form = createTestForm()

    const current = getFormStateAdapterContext(form).configuration.state.value

    const view = form.getViewSchemas()

    expect(() =>
      form.setConfig({ [key]: undefined } as FormConfig<{
        name: string
        fixed: string
        extra: string
      }>)
    ).toThrow(`creation option "${key}"`)
    expect(getFormStateAdapterContext(form).configuration.state.value).toBe(current)
    expect(form.getViewSchemas()).toBe(view)
    form.destroy()
  })

  it("消费配置撤销不会替换创建时选择的 Registry", () => {
    const api = createSchemx()

    const consumer = createSchemx()

    const form = api.createForm({
      rendererRegistry: consumer.rendererRegistry,
      presetRuleRegistry: consumer.presetRuleRegistry,
    })

    form.setConfig({})
    expect(
      getFormStateAdapterContext(form).configuration.state.value.rendererRegistry
    ).toBe(consumer.rendererRegistry)
    expect(
      getFormStateAdapterContext(form).configuration.state.value.presetRuleRegistry
    ).toBe(consumer.presetRuleRegistry)
    form.destroy()
  })

  it("销毁开始后关闭配置入口，节点卸载钩子不能再提交", () => {
    const form: SchemxInstance<{ name: string }> = createForm({
      initialValues: { name: "" },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
      lifecycleHooks: {
        unmounted: () => form.setConfig({ schemaConfig: { readonly: true } }),
      },
    })

    const changed = vi.fn()

    getFormStateAdapterContext(form).configuration.state.subscribe(changed)
    const current = getFormStateAdapterContext(form).configuration.state.value

    form.destroy()
    form.setConfig({})
    form.updateSchemaConfig({ readonly: true })
    getFormStateAdapterContext(form).configuration.state.subscribe(changed)()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(getFormStateAdapterContext(form).configuration.state.value).toBe(current)
  })
})
