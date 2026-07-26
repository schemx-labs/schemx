/**
 * ValidationEffect 模块测试。
 *
 * @module core/runtime/field/__tests__/validationEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createSignal, createSignalEffect } from "../../../reactivity"
import type { SchemaRuntimeContext } from "../../context"
import { createScheduler } from "../../scheduler"
import { createValidationEffect } from "../validationEffect"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../runtimeState"

import type { FieldDescriptor } from "../../descriptor"
import type { SchemxBaseField } from "../../../types"

interface TestValues {
  field?: string
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

const createDescriptor = (schema = createSchema()): FieldDescriptor<TestValues> => ({
  type: "field",
  key: "field:0:field",
  name: schema.name,
  componentType: schema.componentType,
  staticSchema: schema,
})

const createFormConfigContext = () => {
  const scheduler = createScheduler()
  const instance = {
    validateField: vi.fn(),
  }
  const validation = {
    syncField: vi.fn(),
    removeField: vi.fn(),
  }

  return {
    context: {
      instance,
      scheduler,
      validation,
    } as unknown as SchemaRuntimeContext<TestValues>,
    instance,
    validation,
    scheduler,
  }
}

// createValidationEffect 基本功能：规则注册与可见性/只读/禁用联动
describe("createValidationEffect", () => {
  it("应该创建只负责规则注册的 ValidationEffect", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const { context, validation: controller, scheduler } = createFormConfigContext()

    const validation = createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    await scheduler.flush()

    expect(validation.registered.value).toBe(true)
    expect(validation).not.toHaveProperty("validating")
    expect(validation).not.toHaveProperty("validate")
    expect(controller.syncField).toHaveBeenCalledWith({
      name: "field",
      label: "字段",
      required: true,
      rules: [],
    })
  })

  it("showRequiredMark=false 时仍应注册 required 校验", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(
      createSchema({ required: true, showRequiredMark: false })
    )
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    await scheduler.flush()

    expect(controller.syncField).toHaveBeenCalledWith({
      name: "field",
      label: "字段",
      required: true,
      rules: [],
    })
  })
})

// 规则管理：visible=false / readonly / disabled 时注销规则并清空错误
describe("rule management", () => {
  it("应该在 visible=false 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ visible: false }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    await scheduler.flush()

    expect(controller.removeField).toHaveBeenCalledWith("field")
  })

  it("应该在 readonly=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ readonly: true }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    await scheduler.flush()

    expect(controller.removeField).toHaveBeenCalledWith("field")
  })

  it("应该在 disabled=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ disabled: true }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    await scheduler.flush()

    expect(controller.removeField).toHaveBeenCalledWith("field")
  })

  it("字段呈现态在响应式 effect 中变化时不应同步写 Validator 造成循环", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: {
        name: descriptor.staticSchema.name,
        staticSchema: descriptor.staticSchema,
      },
    })
    const trigger = createSignal(0)
    const { context, validation: controller, scheduler } = createFormConfigContext()

    createValidationEffect({
      context,
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
    })

    const dispose = createSignalEffect(() => {
      if (trigger.value > 0) {
        setFieldDynamicOverrides(
          runtimeState,
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

    expect(controller.removeField).toHaveBeenCalledWith("field")

    dispose()
  })
})

import type { SchemxResolvedBaseField } from "../../../types"

function createTestSchemaForUS2(
  overrides: Partial<SchemxResolvedBaseField> = {}
): SchemxResolvedBaseField {
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
  } as SchemxResolvedBaseField
}

// validationEffect 从 effectiveSchema 读取 rules、visible/readonly/disabled 和 label 信息
describe("validationEffect 读取 effectiveSchema (US2)", () => {
  it("effectiveSchema 应包含 rules 信息供 validation 读取", () => {
    const schema = createTestSchemaForUS2({ required: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    expect(state.effectiveSchema.value.required).toBe(true)
  })

  it("dynamicOverrides 更新 rules 后 effectiveSchema 应反映新 rules", () => {
    const schema = createTestSchemaForUS2({ required: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(
      state,
      { rules: [{ min: 3 }] as any },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
      }
    )

    expect(state.effectiveSchema.value.rules).toEqual([{ min: 3 }])
  })

  it("effectiveSchema 应包含 visible/readonly/disabled 供 validation 判断", () => {
    const schema = createTestSchemaForUS2({
      visible: true,
      readonly: false,
      disabled: false,
    })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.readonly).toBe(false)
    expect(state.effectiveSchema.value.disabled).toBe(false)

    setFieldDynamicOverrides(
      state,
      { visible: false, readonly: true },
      {
        source: "dependencies",
        triggerFields: ["status" as any],
      }
    )

    expect(state.effectiveSchema.value.visible).toBe(false)
    expect(state.effectiveSchema.value.readonly).toBe(true)
  })

  it("effectiveSchema 应包含 label 供 validation 错误消息使用", () => {
    const schema = createTestSchemaForUS2({ label: "邮箱地址" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    expect(state.effectiveSchema.value.label).toBe("邮箱地址")
  })
})
