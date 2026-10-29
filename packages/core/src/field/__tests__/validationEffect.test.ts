/**
 * ValidationEffect 模块测试。
 *
 * @module core/field/__tests__/validationEffect.test
 */

import { describe, expect, it, vi } from "vite-plus/test"

import { createValidationEffect } from ".."
import { createNodeManager, createScope } from "../../node"
import {
  createFieldRuntimeSignals,
  setFieldCompiledSchema,
  setFieldDependencyOverrides,
} from "../../node/__tests__/signalsTestUtils"
import { createSignal, createSignalEffect } from "../../reactivity"
import { createScheduler } from "../../scheduler"

import type { FormRuntimeContext } from "../../runtimeContext"
import type { SchemxBaseField } from "../../types"

interface TestValues {
  field?: string
}

interface FieldConfig {
  readonly key: string
  readonly compiledSchema: SchemxBaseField<TestValues>
}

const createSchema = (
  overrides: Partial<SchemxBaseField<TestValues>> = {}
): SchemxBaseField<TestValues> => ({
  name: "field",
  label: "字段",
  componentType: "input",
  visible: true,
  readonly: false,
  disabled: false,
  required: true,
  ...overrides,
})

const createFieldConfig = (schema = createSchema()): FieldConfig => ({
  key: "field:0:field",
  compiledSchema: schema as SchemxBaseField<TestValues>,
})

const createFormConfigContext = () => {
  const scheduler = createScheduler()

  const instance = {
    validateField: vi.fn(),
  }

  const validation = {
    setFieldConfig: vi.fn(),
    setFieldRules: vi.fn(),
    removeField: vi.fn(),
  }

  return {
    context: {
      instance,
      scheduler,
      validator: {
        setFieldConfig: validation.setFieldConfig,
        setFieldRules: validation.setFieldRules,
        removeField: validation.removeField,
      },
      fieldRules: {},
      nodeManager: createNodeManager<TestValues>(),
    } as unknown as FormRuntimeContext<TestValues>,
    instance,
    validation,
    scheduler,
  }
}

// createValidationEffect 基本功能：规则注册与可见性/只读/禁用联动
describe("createValidationEffect", () => {
  it("应该创建只负责规则注册的 ValidationEffect", async () => {
    const scope = createScope()

    const config = createFieldConfig()

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    const validation = createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    await scheduler.flush()

    expect(validation).not.toHaveProperty("registered")
    expect(validation).not.toHaveProperty("validating")
    expect(validation).not.toHaveProperty("validate")
    expect(controller.setFieldConfig).toHaveBeenCalledWith({
      name: "field",
      label: "字段",
      placeholder: "",
      required: true,
      active: true,
    })
    expect(controller.setFieldRules).toHaveBeenCalledWith("field", [])
  })

  it("showRequiredMark=false 时仍应注册 required 校验", async () => {
    const scope = createScope()

    const config = createFieldConfig(
      createSchema({ required: true, showRequiredMark: false })
    )

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    await scheduler.flush()

    expect(controller.setFieldConfig).toHaveBeenCalledWith({
      name: "field",
      label: "字段",
      placeholder: "",
      required: true,
      active: true,
    })
    expect(controller.setFieldRules).toHaveBeenCalledWith("field", [])
  })

  it("仅更新 placeholder 不会重新同步校验规则", async () => {
    const scope = createScope()

    const config = createFieldConfig()

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })
    await scheduler.flush()
    controller.setFieldConfig.mockClear()
    controller.setFieldRules.mockClear()

    setFieldCompiledSchema(runtimeSignals, {
      name: "field",
      compiledSchema: { ...config.compiledSchema, placeholder: "新的提示" },
    })
    await scheduler.flush()

    expect(controller.setFieldConfig).not.toHaveBeenCalled()
    expect(controller.setFieldRules).not.toHaveBeenCalled()
  })
})

// 非交互字段暂停校验，保留手动规则；字段卸载才注销规则。
describe("rule management", () => {
  it("visible=false 时按路径暂停校验", async () => {
    const scope = createScope()

    const config = createFieldConfig(createSchema({ visible: false }))

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    await scheduler.flush()

    expect(controller.setFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: "field", active: false })
    )
    expect(controller.removeField).not.toHaveBeenCalled()
  })

  it("readonly=true 时按路径暂停校验", async () => {
    const scope = createScope()

    const config = createFieldConfig(createSchema({ readonly: true }))

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    await scheduler.flush()

    expect(controller.setFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: "field", active: false })
    )
  })

  it("disabled=true 时按路径暂停校验", async () => {
    const scope = createScope()

    const config = createFieldConfig(createSchema({ disabled: true }))

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    await scheduler.flush()

    expect(controller.setFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: "field", active: false })
    )
  })

  it("字段呈现态在响应式 effect 中变化时不应同步写 Validator 造成循环", async () => {
    const scope = createScope()

    const config = createFieldConfig()

    const runtimeSignals = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: config.key,
      name: config.compiledSchema.name,
      compiledSchema: config.compiledSchema,
    })

    const trigger = createSignal(0)

    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      nodeId: 1,
      name: "field",
      validationState: runtimeSignals.validationState,
      scope,
    })

    const dispose = createSignalEffect(() => {
      if (trigger.value > 0) {
        setFieldDependencyOverrides(
          runtimeSignals,
          {
            visible: false,
          },
          {
            source: "dependencies",
            triggerFields: ["status" as any],
          }
        )
      }
    })

    expect(() => {
      trigger.value = 1
    }).not.toThrow()

    await scheduler.flush()

    expect(controller.setFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: "field", active: false })
    )

    dispose()
  })
})

function createTestSchemaForUS2(
  overrides: Partial<SchemxBaseField<TestValues>> = {}
): SchemxBaseField<TestValues> {
  return {
    componentType: "input",
    label: "测试字段",
    visible: true,
    disabled: false,
    readonly: false,
    required: false,
    placeholder: "请输入",
    componentProps: {},
    rules: [],
    validationTrigger: "onChange",
    ...overrides,
  } as SchemxBaseField<TestValues>
}

// validationEffect 从 resolvedSchema 读取 rules、visible/readonly/disabled 和 label 信息
describe("validationEffect 读取 resolvedSchema (US2)", () => {
  it("resolvedSchema 应包含 rules 信息供 validation 读取", () => {
    const schema = createTestSchemaForUS2({ required: true })

    const state = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
    })

    expect(state.resolvedSchema.value.required).toBe(true)
  })

  it("dependencyOverrides 更新 rules 后 resolvedSchema 应反映新 rules", () => {
    const schema = createTestSchemaForUS2({ required: true })

    const state = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
    })

    setFieldDependencyOverrides(
      state,
      { rules: [{ min: 3 }] as any },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
      }
    )

    expect(state.resolvedSchema.value.rules).toEqual([{ min: 3 }])
  })

  it("resolvedSchema 应包含 visible/readonly/disabled 供 validation 判断", () => {
    const schema = createTestSchemaForUS2({
      visible: true,
      readonly: false,
      disabled: false,
    })

    const state = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
    })

    expect(state.resolvedSchema.value.visible).toBe(true)
    expect(state.resolvedSchema.value.readonly).toBe(false)
    expect(state.resolvedSchema.value.disabled).toBe(false)

    setFieldDependencyOverrides(
      state,
      { visible: false, readonly: true },
      {
        source: "dependencies",
        triggerFields: ["status" as any],
      }
    )

    expect(state.resolvedSchema.value.visible).toBe(false)
    expect(state.resolvedSchema.value.readonly).toBe(true)
  })

  it("resolvedSchema 应包含 label 供 validation 错误消息使用", () => {
    const schema = createTestSchemaForUS2({ label: "邮箱地址" })

    const state = createFieldRuntimeSignals<TestValues>({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
    })

    expect(state.resolvedSchema.value.label).toBe("邮箱地址")
  })
})
