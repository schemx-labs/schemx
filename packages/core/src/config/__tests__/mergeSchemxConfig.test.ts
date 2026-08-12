import { describe, expect, it } from "vitest"

import { createRendererRegistry, createValidationRuleRegistry } from "../../registry"
import {
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
} from "../mergeSchemxConfig"

describe("mergeSchemxConfig", () => {
  it("按从后到前的优先级合并标量配置和 Registry", () => {
    // 高优先级 Renderer Registry。
    const highPriorityRendererRegistry = createRendererRegistry()

    // 低优先级 Renderer Registry。
    const lowPriorityRendererRegistry = createRendererRegistry()

    // 高优先级校验规则 Registry。
    const highPriorityRuleRegistry = createValidationRuleRegistry()

    // 低优先级校验规则 Registry。
    const lowPriorityRuleRegistry = createValidationRuleRegistry()

    const result = mergeSchemxConfig(
      {
        defaultRendererType: "high",
        rendererRegistry: highPriorityRendererRegistry,
        validationRuleRegistry: highPriorityRuleRegistry,
      },
      {
        defaultRendererType: "low",
        rendererRegistry: lowPriorityRendererRegistry,
        validationRuleRegistry: lowPriorityRuleRegistry,
      }
    )

    expect(result).toMatchObject({
      defaultRendererType: "high",
      rendererRegistry: highPriorityRendererRegistry,
      validationRuleRegistry: highPriorityRuleRegistry,
    })
  })

  it("保留 schemaConfig 中高优先级显式 undefined", () => {
    const result = mergeSchemxConfig(
      { schemaConfig: { readonly: undefined, labelWidth: "120px" } },
      { schemaConfig: { readonly: true, disabled: true, labelWidth: "80px" } }
    )

    expect(result.schemaConfig).toMatchObject({
      readonly: undefined,
      disabled: true,
      labelWidth: "120px",
    })
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

    const result = mergeSchemxConfig(
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

  it("按低到高优先级排列 validatorAdapters，且不修改输入数组", () => {
    // 低优先级 adapter 列表。
    const lowPriorityAdapters = [{ id: "low" }]

    // 高优先级 adapter 列表。
    const highPriorityAdapters = [{ id: "high" }]

    const result = mergeSchemxConfig(
      { validatorAdapters: highPriorityAdapters as never },
      { validatorAdapters: lowPriorityAdapters as never }
    )

    expect(result.validatorAdapters).toEqual([
      ...lowPriorityAdapters,
      ...highPriorityAdapters,
    ])
    expect(result.validatorAdapters).not.toBe(lowPriorityAdapters)
    expect(result.validatorAdapters).not.toBe(highPriorityAdapters)
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
