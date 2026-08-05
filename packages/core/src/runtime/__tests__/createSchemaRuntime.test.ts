import { describe, expect, it } from "vitest"

import { mergeAndResolveSchemxConfig } from "../../config"
import { createSchemaRuntime } from "../createSchemaRuntime"

import type { RuntimeFormModelPort } from "../../form/model"
import type { SchemxFormApi, SchemxInstance, Values } from "../../types"

describe("SchemaRuntime", () => {
  it("通过假的最小 Model Port 应用字段 initialValue", () => {
    const model = createTestModelPort<{ name?: string }>()
    const instance = {} as SchemxInstance
    const runtime = createSchemaRuntime({
      model,
      instance,
      formApi: {} as SchemxFormApi,
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.mount([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
        initialValue: "Alice",
      },
    ])

    expect(model.getFieldValue("name")).toBe("Alice")
    expect(model.getInitialValue("name")).toBe("Alice")
    expect(runtime.getViewSchemas()[0]?.componentProps?.formInstance).toBe(instance)

    runtime.dispose()
  })

  it("独立管理 Schema source、ViewSchema 和 mount 生命周期", () => {
    const model = createTestModelPort<{ name?: string; email?: string }>()
    const runtime = createSchemaRuntime({
      model,
      instance: {} as SchemxInstance,
      formApi: {} as SchemxFormApi,
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.mount([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
      },
    ])

    runtime.updateSchemas(() => [
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
      },
    ])

    expect(runtime.getViewSchemas().map((schema) => schema.name)).toEqual(["email"])
    expect(() => runtime.mount()).toThrow("Schema runtime is already mounted")

    runtime.dispose()
  })
})

function createTestModelPort<TValues extends Values>(): RuntimeFormModelPort<TValues> & {
  getInitialValue(name: string): unknown
} {
  const values = new Map<string, unknown>()
  const initialValues = new Map<string, unknown>()

  return {
    getFieldValue(name) {
      return values.get(String(name)) as never
    },
    setFieldValue(name, value) {
      values.set(String(name), value)
    },
    setInitialValues(nextValues) {
      for (const [name, value] of Object.entries(nextValues)) {
        initialValues.set(name, value)
      }
    },
    syncValidationField() {
      return true
    },
    removeValidationField() {},
    getInitialValue(name) {
      return initialValues.get(name)
    },
  }
}
