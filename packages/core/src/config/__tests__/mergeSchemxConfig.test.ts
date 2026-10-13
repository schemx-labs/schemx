import { describe, expect, it } from "vite-plus/test"

import { createPresetRuleRegistry, createRendererRegistry } from "../../registry"
import {
  mergeAndResolveSchemxConfig,
  mergeConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
} from "../mergeSchemxConfig"

import type { SchemxSchemaConfig, ValidationTrigger } from "../../types"
import type { SchemxConfig } from "../schemxConfig"

interface LayoutConfig extends SchemxConfig {
  schemaConfig?: Partial<SchemxSchemaConfig> & {
    row?: { gutter?: number; align?: string; justify?: string }
    col?: { span: number; offset?: number }
  }
}

describe("mergeConfig", () => {
  it("过滤所有实例字段，保留共享扩展和原始创建选项", () => {
    const callback = () => undefined

    const input = {
      schemaConfig: { readonly: true },
      debug: true,
      schemas: [],
      initialValues: { name: "A" },
      fieldRules: {},
      lifecycleHooks: {},
      onRuleError: callback,
      onFinish: callback,
      onFinishFailed: callback,
      onReset: callback,
      onLoadingChange: callback,
      onValuesChange: callback,
      onFieldsChange: callback,
      extensionMarker: { theme: "custom" },
    }

    const result = mergeConfig(input)

    for (const key of [
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
    ]) {
      expect(result).not.toHaveProperty(key)
      expect(input).toHaveProperty(key)
    }

    expect(result.debug).toBe(true)
    expect(result.schemaConfig?.readonly).toBe(true)
    expect(Object.getOwnPropertyDescriptor(result, "extensionMarker")?.value).toBe(
      input.extensionMarker
    )
    expect(Object.isFrozen(input.extensionMarker)).toBe(false)
  })

  it("隔离并冻结受管快照，Registry 与其他实现保持引用", () => {
    const registry = createRendererRegistry()

    const rules = createPresetRuleRegistry()

    const adapter = { id: "snapshot", isRule: () => false, resolve: () => [] }

    const nested = { theme: "light" }

    const rendererProps = { input: { disabled: true, metadata: nested } }

    const schemaConfig = { readonly: true }

    const schedulerOptions = { timeSliceMs: 3, idleTimeout: 50 }

    const validatorAdapters = [adapter]

    const input = {
      schemaConfig,
      schedulerOptions,
      rendererProps,
      validatorAdapters,
      rendererRegistry: registry,
      presetRuleRegistry: rules,
    }

    const result = mergeConfig(input)

    schemaConfig.readonly = false
    schedulerOptions.timeSliceMs = 99
    rendererProps.input.disabled = false
    validatorAdapters.length = 0
    nested.theme = "dark"
    expect(result.schemaConfig?.readonly).toBe(true)
    expect(result.schedulerOptions?.timeSliceMs).toBe(3)
    expect(result.rendererProps?.input?.disabled).toBe(true)
    expect(result.validatorAdapters).toEqual([adapter])
    for (const value of [
      result,
      result.schemaConfig,
      result.rendererProps,
      result.rendererProps?.input,
      result.validatorAdapters,
      result.schedulerOptions,
    ]) {
      expect(Object.isFrozen(value)).toBe(true)
    }

    expect(result.rendererRegistry).toBe(registry)
    expect(result.presetRuleRegistry).toBe(rules)
    expect(
      Object.getOwnPropertyDescriptor(result.rendererProps?.input ?? {}, "metadata")
        ?.value
    ).toBe(nested)
    expect(nested.theme).toBe("dark")
    for (const value of [
      input,
      schemaConfig,
      rendererProps,
      rendererProps.input,
      validatorAdapters,
      schedulerOptions,
      nested,
      adapter,
      registry,
      rules,
    ]) {
      expect(Object.isFrozen(value)).toBe(false)
    }

    registry.register("custom", "CUSTOM")
    expect(result.rendererRegistry?.get("custom")).toBe("CUSTOM")
  })

  it("缺省保持缺省，调度对象整体替换，显式 false 优先", () => {
    const empty = mergeConfig()

    expect(Object.keys(empty)).toEqual([])
    expect(Object.isFrozen(empty)).toBe(true)
    expect(mergeConfig({ debug: false })).not.toHaveProperty("schemaConfig")
    const result = mergeConfig(
      { debug: false, schedulerOptions: { idleTimeout: 20 } },
      { debug: true, schedulerOptions: { timeSliceMs: 3, collectDiagnostics: true } }
    )

    expect(result.debug).toBe(false)
    expect(result.schedulerOptions).toEqual({ idleTimeout: 20 })
    expect(
      mergeConfig(
        { schemaConfig: { readonly: undefined } },
        { schemaConfig: { readonly: true } }
      ).schemaConfig
    ).toHaveProperty("readonly", undefined)
  })
  it("空调用、变参和数组调用均保留嵌套结构", () => {
    const config = { schemaConfig: { readonly: true } }

    expect(mergeConfig()).toEqual({})
    expect(mergeConfig(config)).toEqual(config)
    expect(mergeConfig([config])).toEqual(config)
    expect(resolveSchemxConfig(config)).not.toHaveProperty("readonly")
  })

  it("Row 可选择替换或属性继承，其他字段保留选中引用", () => {
    const row = { justify: "center" }

    const col = { span: 12 }

    const configs: LayoutConfig[] = [
      { schemaConfig: { row, col } },
      {
        schemaConfig: {
          row: { gutter: 8, align: "middle" },
          col: { span: 24, offset: 1 },
        },
      },
    ]

    const replaced = mergeConfig(configs)

    const inherited = mergeConfig(configs, { rowMerge: "inherit" })

    expect(Reflect.get(replaced.schemaConfig ?? {}, "row")).toBe(row)
    expect(inherited.schemaConfig).toEqual({
      row: { gutter: 8, align: "middle", justify: "center" },
      col,
    })
    expect(Reflect.get(inherited.schemaConfig ?? {}, "col")).toBe(col)
    expect(inherited).not.toHaveProperty("row")
    expect(inherited).not.toHaveProperty("col")
    expect(configs[1].schemaConfig?.row).toEqual({ gutter: 8, align: "middle" })

    const cleared: LayoutConfig[] = [{ schemaConfig: { row: undefined } }, configs[1]]

    expect(
      Reflect.get(mergeConfig(cleared, { rowMerge: "inherit" }).schemaConfig ?? {}, "row")
    ).toBeUndefined()
  })

  it("合并不补齐内置默认值", () => {
    const configs: LayoutConfig[] = [
      { schemaConfig: { readonly: true, row: { gutter: 8 } } },
    ]

    const result = mergeConfig(configs, { rowMerge: "inherit" })

    expect(result.schemaConfig).toEqual({ readonly: true, row: { gutter: 8 } })
    expect(result.schemaConfig).not.toHaveProperty("visible")
  })

  it("合并适配层扩展的顶层配置，并保留对象引用与 undefined 的继承语义", () => {
    const inheritedOptions = { theme: "low" }

    const overridingOptions = { theme: "high" }

    const lower = { defaultRendererType: "input", adapterOptions: inheritedOptions }

    const higher = { defaultRendererType: undefined, adapterOptions: overridingOptions }

    const result = mergeConfig(higher, lower)

    expect(result).toMatchObject({
      defaultRendererType: "input",
      adapterOptions: overridingOptions,
    })
    expect(Object.getOwnPropertyDescriptor(result, "adapterOptions")?.value).toBe(
      overridingOptions
    )
    expect(lower.adapterOptions).toBe(inheritedOptions)
  })

  it("按从后到前的优先级合并标量配置和 Registry", () => {
    // 高优先级 Renderer Registry。
    const highPriorityRendererRegistry = createRendererRegistry()

    // 低优先级 Renderer Registry。
    const lowPriorityRendererRegistry = createRendererRegistry()

    // 高优先级校验规则 Registry。
    const highPriorityRuleRegistry = createPresetRuleRegistry()

    // 低优先级校验规则 Registry。
    const lowPriorityRuleRegistry = createPresetRuleRegistry()

    const result = mergeConfig(
      {
        defaultRendererType: "high",
        rendererRegistry: highPriorityRendererRegistry,
        presetRuleRegistry: highPriorityRuleRegistry,
      },
      {
        defaultRendererType: "low",
        rendererRegistry: lowPriorityRendererRegistry,
        presetRuleRegistry: lowPriorityRuleRegistry,
      }
    )

    expect(result).toMatchObject({
      defaultRendererType: "high",
      rendererRegistry: highPriorityRendererRegistry,
      presetRuleRegistry: highPriorityRuleRegistry,
    })
  })

  it("保留 schemaConfig 中高优先级显式 undefined", () => {
    const result = mergeConfig(
      { schemaConfig: { readonly: undefined, labelWidth: "120px" } },
      { schemaConfig: { readonly: true, disabled: true, labelWidth: "80px" } }
    )

    expect(result.schemaConfig).toMatchObject({
      readonly: undefined,
      disabled: true,
      labelWidth: "120px",
    })
  })

  it("以高优先级 schemaConfig 属性整体替换数组值", () => {
    // 高优先级触发器数组应由结果直接引用，而不是与低优先级数组按索引合并。
    const highPriorityTriggers = ["submit"] satisfies ValidationTrigger[]

    const result = mergeConfig(
      { schemaConfig: { validationTrigger: highPriorityTriggers } },
      { schemaConfig: { validationTrigger: ["blur", "change"] } }
    )

    expect(result.schemaConfig?.validationTrigger).toBe(highPriorityTriggers)
    expect(result.schemaConfig?.validationTrigger).toEqual(["submit"])
  })

  it("按 Renderer 浅合并 Props 并保留高优先级显式 undefined", () => {
    const lowPriorityNested = { source: "low", retained: true }

    const highPriorityNested = { source: "high" }

    const lowPriorityOptions = [{ label: "低优先级" }]

    const highPriorityOptions = [{ label: "高优先级" }]

    const lowPriorityRendererProps = {
      input: {
        disabled: false,
        options: lowPriorityOptions,
        placeholder: "低优先级",
        nested: lowPriorityNested,
      },
      picker: {
        readonly: true,
      },
    }

    const highPriorityRendererProps = {
      input: {
        disabled: true,
        options: highPriorityOptions,
        placeholder: undefined,
        nested: highPriorityNested,
      },
    }

    const result = mergeConfig(
      { rendererProps: highPriorityRendererProps as never },
      { rendererProps: lowPriorityRendererProps as never }
    )

    expect(result.rendererProps).toEqual({
      input: {
        disabled: true,
        options: highPriorityOptions,
        placeholder: undefined,
        nested: highPriorityNested,
      },
      picker: {
        readonly: true,
      },
    })
    expect(result.rendererProps).not.toBe(highPriorityRendererProps)
    expect(result.rendererProps).not.toBe(lowPriorityRendererProps)
    expect(result.rendererProps?.input).not.toBe(highPriorityRendererProps.input)
    expect(
      Object.prototype.hasOwnProperty.call(result.rendererProps?.input, "placeholder")
    ).toBe(true)
    expect((result.rendererProps?.input as { nested?: unknown }).nested).toBe(
      highPriorityNested
    )
    expect((result.rendererProps?.input as { options?: unknown }).options).toBe(
      highPriorityOptions
    )
    expect(lowPriorityRendererProps.input).toEqual({
      disabled: false,
      options: lowPriorityOptions,
      placeholder: "低优先级",
      nested: lowPriorityNested,
    })
    expect(highPriorityRendererProps.input).toEqual({
      disabled: true,
      options: highPriorityOptions,
      placeholder: undefined,
      nested: highPriorityNested,
    })
  })

  it("按 ID 合并 validatorAdapters，并按高到低优先级排列", () => {
    // 低优先级同 ID adapter 应被高优先级配置替换。
    const lowPrioritySharedAdapter = { id: "shared", source: "low" }

    // 高优先级同 ID adapter 应保留在最终列表中。
    const highPrioritySharedAdapter = { id: "shared", source: "high" }

    // 不冲突的 adapter 按各配置层内的原始顺序保留。
    const lowPriorityAdapter = { id: "low" }

    // 高优先级独有 adapter 排在低优先级 adapter 之前。
    const highPriorityAdapter = { id: "high" }

    // 高优先级配置层内的 adapter 顺序。
    const highPriorityAdapters = [highPrioritySharedAdapter, highPriorityAdapter]

    // 低优先级配置层内的 adapter 顺序。
    const lowPriorityAdapters = [lowPrioritySharedAdapter, lowPriorityAdapter]

    const result = mergeConfig(
      { validatorAdapters: highPriorityAdapters as never },
      { validatorAdapters: lowPriorityAdapters as never }
    )

    expect(result.validatorAdapters).toEqual([
      highPrioritySharedAdapter,
      highPriorityAdapter,
      lowPriorityAdapter,
    ])
    expect(result.validatorAdapters).not.toBe(lowPriorityAdapters)
    expect(result.validatorAdapters).not.toBe(highPriorityAdapters)
  })
})

describe("mergeSchemxConfig", () => {
  it("作为 mergeConfig 的弃用兼容名称", () => {
    expect(mergeSchemxConfig).toBe(mergeConfig)
  })
})

describe("resolveSchemxConfig", () => {
  it("补齐缺失和显式 undefined 的 Schema 内置默认值", () => {
    // 保留用于验证输入不被修改的原始配置。
    const config = {
      schemaConfig: { readonly: undefined, labelWidth: "120px" },
    }

    const result = resolveSchemxConfig(config)

    expect(result.schemaConfig).toMatchObject({
      readonly: false,
      disabled: false,
      labelWidth: "120px",
    })
    expect(config.schemaConfig.readonly).toBeUndefined()
    expect(config.schemaConfig).not.toHaveProperty("disabled")
  })
})

describe("mergeAndResolveSchemxConfig", () => {
  it("组合纯合并和默认值补齐", () => {
    const result = mergeAndResolveSchemxConfig(
      { schemaConfig: { readonly: undefined, labelWidth: "120px" } },
      { schemaConfig: { readonly: true, disabled: true, labelWidth: "80px" } }
    )

    expect(result.schemaConfig).toMatchObject({
      readonly: false,
      disabled: true,
      labelWidth: "120px",
    })
  })

  it("未传入配置时返回完整的内置 schemaConfig", () => {
    expect(mergeAndResolveSchemxConfig().schemaConfig).toMatchObject({
      readonly: false,
      disabled: false,
      labelWidth: "auto",
    })
  })
})
