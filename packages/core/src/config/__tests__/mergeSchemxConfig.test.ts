import { describe, expect, it } from "vitest"

import { createPresetRuleRegistry, createRendererRegistry } from "../../registry"
import {
  mergeAndResolveSchemxConfig,
  mergeConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
} from "../mergeSchemxConfig"

import type { ValidationTrigger } from "../../types"

describe("mergeConfig", () => {
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
        align: "left",
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
        align: "left",
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
      align: "left",
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
