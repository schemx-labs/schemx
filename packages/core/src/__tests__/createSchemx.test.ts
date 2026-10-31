import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  configureSchemx as configureCore,
  createForm,
  createFormStateAdapter,
  createSchemx,
  getFormCreationConfig,
} from "../index"

import type { SchemxField, ValidationRuleResult } from "../index"

interface FormValues {
  name: string
}
const schemas: SchemxField<FormValues>[] = [
  { name: "name", label: "Name", componentType: "input" },
]

const options = { schemas, initialValues: { name: "A" } }

const Renderer = {}

afterEach(() => {
  configureCore()
  vi.restoreAllMocks()
})

describe("Core createSchemx", () => {
  it("仅返回五项配置与创建 API，独立实例不继承配置", () => {
    const api = createSchemx({ schemaConfig: { disabled: true } })

    expect(Object.keys(api).sort()).toEqual([
      "configureSchemx",
      "createForm",
      "getConfig",
      "presetRuleRegistry",
      "rendererRegistry",
    ])
    const fresh = createSchemx()

    expect(fresh.getConfig().schemaConfig?.disabled).toBeUndefined()
    expect(fresh.rendererRegistry).not.toBe(api.rendererRegistry)
  })

  it("创建和更新过滤实例属性，保留扩展值及局部实例行为", async () => {
    const sharedCallback = vi.fn()

    const input = {
      debug: true,
      schemas,
      initialValues: { name: "shared" },
      fieldRules: { name: [] },
      lifecycleHooks: {},
      onRuleError: sharedCallback,
      onFinish: sharedCallback,
      onFinishFailed: sharedCallback,
      onReset: sharedCallback,
      onLoadingChange: sharedCallback,
      onValuesChange: sharedCallback,
      onFieldsChange: sharedCallback,
      extensionMarker: "kept",
    }

    const api = createSchemx(input)

    const excluded = [
      "schemas",
      "initialValues",
      "fieldRules",
      "lifecycleHooks",
      "onRuleError",
      "onFinish",
      "onFinishFailed",
      "onReset",
      "onLoadingChange",
      "onValuesChange",
      "onFieldsChange",
    ]

    for (const key of excluded) {
      expect(Object.hasOwn(api.getConfig(), key)).toBe(false)
    }

    expect(api.getConfig()).toHaveProperty("extensionMarker", "kept")
    expect(input.initialValues.name).toBe("shared")
    const empty = api.createForm()

    expect(empty.getViewSchemas()).toEqual([])
    expect(empty.getFieldsValue()).toEqual({})
    await empty.submit()
    expect(sharedCallback).not.toHaveBeenCalled()
    const finished = vi.fn()

    const local = api.createForm({ ...options, onFinish: finished })

    await local.submit()
    expect(finished).toHaveBeenCalledOnce()
    api.configureSchemx(input)
    for (const key of excluded) {
      expect(Object.hasOwn(api.getConfig(), key)).toBe(false)
    }

    empty.destroy()
    local.destroy()
  })

  it("调度配置快照隔离输入，整体替换并可恢复基线", () => {
    const schedulerOptions = { timeSliceMs: 3, collectDiagnostics: true }

    const api = createSchemx({
      debug: true,
      schedulerOptions,
      validationConcurrency: 2,
    })

    schedulerOptions.timeSliceMs = 99
    expect(api.getConfig().schedulerOptions).toEqual({
      timeSliceMs: 3,
      collectDiagnostics: true,
    })
    expect(Object.isFrozen(api.getConfig().schedulerOptions)).toBe(true)
    api.configureSchemx({ debug: false, schedulerOptions: { collectDiagnostics: false } })
    expect(api.getConfig().debug).toBe(false)
    expect(api.getConfig().schedulerOptions).toEqual({ collectDiagnostics: false })
    api.configureSchemx({ validationConcurrency: 1 })
    expect(api.getConfig().debug).toBe(true)
    expect(api.getConfig().schedulerOptions).toEqual({
      timeSliceMs: 3,
      collectDiagnostics: true,
    })
    api.configureSchemx()
    expect(api.getConfig().validationConcurrency).toBe(2)
  })

  it("受控异步校验实际遵循共享并发限制", async () => {
    const api = createSchemx({ validationConcurrency: 1 })

    const releases: Array<() => void> = []

    let running = 0

    let maximum = 0

    const rule = {
      validate: (): Promise<ValidationRuleResult> => {
        running += 1
        maximum = Math.max(maximum, running)

        return new Promise<ValidationRuleResult>((resolve) => {
          releases.push(() => {
            running -= 1
            resolve({ valid: true })
          })
        })
      },
    }

    const form = api.createForm({
      initialValues: { first: "A", second: "B" },
      schemas: [
        { name: "first", label: "First", componentType: "input", rules: [rule] },
        { name: "second", label: "Second", componentType: "input", rules: [rule] },
      ],
    })

    try {
      const validation = form.validate()

      await vi.waitFor(() => expect(releases).toHaveLength(1))
      expect(running).toBe(1)
      releases.shift()?.()
      await vi.waitFor(() => expect(releases).toHaveLength(1))
      releases.shift()?.()
      await expect(validation).resolves.toMatchObject({ valid: true })
      expect(maximum).toBe(1)
    } finally {
      for (const release of releases.splice(0)) {
        release()
      }

      form.destroy()
    }
  })

  it("不读取 Core 全局，覆盖层替换、重置仅影响新表单", () => {
    configureCore({ schemaConfig: { disabled: true, readonly: true } })
    const api = createSchemx({ schemaConfig: { labelWidth: 140 } })

    const original = api.createForm(options)

    expect(original.getViewSchemas()[0]).toMatchObject({
      readonly: false,
      disabled: false,
      labelWidth: 140,
    })
    api.configureSchemx({ schemaConfig: { readonly: true } })
    const changed = api.createForm(options)

    expect(changed.getViewSchemas()[0]).toMatchObject({
      readonly: true,
      disabled: false,
      labelWidth: 140,
    })
    expect(original.getViewSchemas()[0]).toMatchObject({ readonly: false })
    api.configureSchemx({ schemaConfig: { labelWidth: 180 } })
    expect(api.getConfig().schemaConfig?.readonly).toBeUndefined()
    expect(Object.isFrozen(api.getConfig())).toBe(true)
    api.configureSchemx()
    expect(api.getConfig().schemaConfig?.labelWidth).toBe(140)
    original.destroy()
    changed.destroy()
  })

  it("Registry 默认隔离、显式共享和局部覆盖，配置更新禁止替换引用", () => {
    const first = createSchemx()

    const second = createSchemx()

    first.rendererRegistry.register("input", Renderer)
    first.presetRuleRegistry.register(
      "required",
      { validate: () => ({ valid: true }) },
      { override: true }
    )
    expect(second.rendererRegistry.has("input")).toBe(false)
    expect(first.presetRuleRegistry.get("required")).not.toBe(
      second.presetRuleRegistry.get("required")
    )
    const shared = createSchemx({
      rendererRegistry: first.rendererRegistry,
      presetRuleRegistry: first.presetRuleRegistry,
    })

    expect(shared.rendererRegistry).toBe(first.rendererRegistry)
    expect(shared.presetRuleRegistry).toBe(first.presetRuleRegistry)
    const snapshot = first.getConfig()

    expect(() =>
      Reflect.apply(first.configureSchemx, undefined, [{ rendererRegistry: undefined }])
    ).toThrow(TypeError)
    expect(() =>
      Reflect.apply(first.configureSchemx, undefined, [
        { presetRuleRegistry: second.presetRuleRegistry },
      ])
    ).toThrow(TypeError)
    expect(first.getConfig()).toBe(snapshot)
    const normal = first.createForm(options)

    const override = first.createForm({
      ...options,
      rendererRegistry: second.rendererRegistry,
    })

    expect(normal.getRenderer("input")).toBe(Renderer)
    expect(override.getRenderer("input")).toBeUndefined()
    normal.destroy()
    override.destroy()
  })

  it("创建记录保留实际配置、固定继承引用和复制语义", () => {
    const api = createSchemx({ debug: true, schemaConfig: { disabled: true } })

    const defaults = api.getConfig()

    const form = api.createForm({ ...options, schemaConfig: { readonly: true } })

    const snapshot = getFormCreationConfig(form)

    expect(snapshot?.config).toBe(createFormStateAdapter(form).config.getSnapshot())
    expect(snapshot?.defaults).toBe(defaults)
    expect(snapshot?.config.schemaConfig).toMatchObject({
      disabled: true,
      readonly: true,
    })
    expect(snapshot?.config.rendererRegistry).toBe(api.rendererRegistry)
    expect(snapshot?.config).not.toHaveProperty("initialValues")
    expect(getFormCreationConfig({ ...form })).toBe(snapshot)
    form.updateSchemaConfig({ readonly: false })
    expect(snapshot?.config.schemaConfig?.readonly).toBe(true)
    const legacy = createForm(options)

    expect(getFormCreationConfig(legacy)?.defaults).toBeUndefined()
    const custom = Object.fromEntries(Object.entries(form))

    expect(getFormCreationConfig(custom as typeof form)).toBeUndefined()
    form.destroy()
    legacy.destroy()
  })

  it("Row、Col 和调度对象在所有工厂层整体替换", () => {
    const baseline = {
      schemaConfig: { readonly: true, row: { gutter: 8 }, col: { span: 12 } },
      schedulerOptions: { timeSliceMs: 3 },
    }

    const api = createSchemx(baseline)

    const override = {
      schemaConfig: { readonly: false, row: { justify: "center" }, col: { offset: 2 } },
      schedulerOptions: { timeSliceMs: 20 },
    }

    api.configureSchemx(override)
    const form = api.createForm()

    expect(
      Reflect.get(getFormCreationConfig(form)?.config.schemaConfig ?? {}, "row")
    ).toEqual({ justify: "center" })
    expect(
      Reflect.get(getFormCreationConfig(form)?.config.schemaConfig ?? {}, "col")
    ).toEqual({ offset: 2 })
    expect(getFormCreationConfig(form)?.config.schedulerOptions).toEqual({
      timeSliceMs: 20,
      collectDiagnostics: false,
    })
    form.destroy()
  })
})
