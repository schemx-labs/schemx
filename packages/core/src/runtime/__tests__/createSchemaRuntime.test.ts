import { describe, expect, it } from "vitest"

import { mergeAndResolveSchemxConfig } from "../../config"
import { createSchemas } from "../../createSchemas"
import { createSchemaRuntime } from "../createSchemaRuntime"

import type { SchemxFormApi, SchemxInstance, Values } from "../../types"
import type { RuntimeStorePort, RuntimeValidationPort } from "../context"

describe("SchemaRuntime", () => {
  it("通过假的最小 Store Port 应用字段 initialValue", () => {
    const store = createTestStorePort<{ name?: string }>()

    const instance = {} as SchemxInstance

    const runtime = createSchemaRuntime({
      schemas: createSchemas([
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          initialValue: "Alice",
        },
      ]),
      store,
      validation: createTestValidationPort(),
      instance,
      formApi: {} as SchemxFormApi,
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.mount()

    expect(store.getFieldValue("name")).toBe("Alice")
    expect(store.getInitialValue("name")).toBe("Alice")
    expect(runtime.getViewSchemas()[0]).toMatchObject({
      componentProps: { formInstance: instance },
    })

    runtime.dispose()
  })

  it("独立管理 Schema source、ViewSchema 和 mount 生命周期", () => {
    const store = createTestStorePort<{ name?: string; email?: string }>()

    const schemas = createSchemas<{ name?: string; email?: string }>([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
      },
    ])

    const runtime = createSchemaRuntime({
      schemas,
      store,
      validation: createTestValidationPort(),
      instance: {} as SchemxInstance,
      formApi: {} as SchemxFormApi,
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.mount()

    schemas.update(() => [
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
      },
    ])

    expect(
      runtime
        .getViewSchemas()
        .map((schema) => ("name" in schema ? schema.name : undefined))
    ).toEqual(["email"])
    expect(() => runtime.mount()).toThrow("Schema runtime is already mounted")

    runtime.dispose()
  })
})

function createTestStorePort<TValues extends Values>(): RuntimeStorePort<TValues> & {
  getInitialValue(name: string): unknown
} {
  const values = new Map<string, unknown>()

  const initialValues = new Map<string, unknown>()

  return {
    registerFieldPath() {},
    unregisterFieldPath() {},
    getFieldValue(name) {
      return values.get(String(name)) as never
    },
    setFieldValue(name, value) {
      values.set(String(name), value)
    },
    removeFieldValue() {},
    setInitialValues(nextValues) {
      for (const [name, value] of Object.entries(nextValues)) {
        initialValues.set(name, value)
      }
    },
    getInitialValue(name) {
      return initialValues.get(name)
    },
  }
}

function createTestValidationPort<
  TValues extends Values,
>(): RuntimeValidationPort<TValues> {
  return {
    setFieldConfig() {},
    setFieldRules() {},
    removeField() {},
  }
}
