/**
 * ValidationEffect 模块测试。
 *
 * @module core/field/__tests__/validationEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createSignal, createSignalEffect } from "../../reactivity"
import { createScheduler } from "../../scheduler"
import { createFieldModel } from "../model"
import { createValidationEffect } from "../validationEffect"

import type { SchemxFormContext } from "../../createForm"
import type { FieldDescriptor } from "../../descriptor"
import type { SchemxBaseField } from "../../types"
import type { ValidateResult } from "../../validator"

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
  rules: "required",
  ...overrides,
})

const createDescriptor = (schema = createSchema()): FieldDescriptor<TestValues> => ({
  type: "field",
  key: "field:0:field",
  schema,
})

const createContext = (
  options: {
    validateResult?: ValidateResult<TestValues>
  } = {}
) => {
  const scheduler = createScheduler()
  const instance = {
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    setFieldError: vi.fn(),
    validateField: vi.fn().mockResolvedValue(
      options.validateResult ?? {
        ok: true,
        values: { field: "value" },
      }
    ),
  }

  return {
    context: {
      instance,
      scheduler,
    } as unknown as SchemxFormContext<TestValues>,
    instance,
    scheduler,
  }
}

describe("createValidationEffect", () => {
  it("应该创建 ValidationEffect 并注册规则", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const fieldModel = createFieldModel(descriptor)
    const { context, instance, scheduler } = createContext()

    const validation = createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validation.registered.value).toBe(true)
    expect(validation.validating.value).toBe(false)
    expect(instance.registerRules).toHaveBeenCalledWith(
      "field",
      descriptor.schema.rules,
      "字段为必填项"
    )
  })
})

describe("rule management", () => {
  it("应该在 visible=false 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ visible: false }))
    const fieldModel = createFieldModel(descriptor)
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 readonly=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ readonly: true }))
    const fieldModel = createFieldModel(descriptor)
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 disabled=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ disabled: true }))
    const fieldModel = createFieldModel(descriptor)
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("字段呈现态在响应式 effect 中变化时不应同步写 Validator 造成循环", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const fieldModel = createFieldModel(descriptor)
    const trigger = createSignal(0)
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    const dispose = createSignalEffect(() => {
      if (trigger.value > 0) {
        fieldModel.snapshot.value = {
          ...fieldModel.snapshot.peek(),
          visible: false,
        }
      }
    })

    expect(() => {
      trigger.value = 1
    }).not.toThrow()

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")

    dispose()
  })
})

describe("validate method", () => {
  it("应该通过 Validator 校验 Store 快照", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const fieldModel = createFieldModel(descriptor)
    const { context, instance } = createContext()

    const validation = createValidationEffect({
      name: "field",
      fieldModel,
      scope,
      context,
    })

    const result = await validation.validate()

    expect(result).toEqual({ ok: true, values: { field: "value" } })
    expect(instance.validateField).toHaveBeenCalledWith("field")
  })
})
