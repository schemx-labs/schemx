import { describe, expect, it, vi } from "vite-plus/test"

import { createSchemaRuntime } from ".."
import { mergeAndResolveSchemxConfig } from "../../config"
import { createSchemas } from "../../createSchemas"

import type { RuntimeStorePort, RuntimeValidationPort } from ".."
import type { SchemxInstance, Values } from "../../types"

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
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.mount(instance)

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

    const schemaConfig = {
      ...mergeAndResolveSchemxConfig().schemaConfig,
      validationTrigger: "blur" as const,
    }

    const runtime = createSchemaRuntime({
      schemas,
      store,
      validation: createTestValidationPort(),
      schemaConfig,
    })

    const instance = {} as SchemxInstance

    runtime.mount(instance)

    const firstSchema = runtime.getViewSchemas()[0]

    if (!firstSchema) {
      throw new Error("ViewSchema 未创建")
    }

    expect(runtime.getNode(firstSchema.nodeId)?.type).toBe("field")
    expect(runtime.getSchemaConfig()).toMatchObject({ validationTrigger: "blur" })

    schemas.update(() => [
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
      },
    ])

    const nextSchema = runtime.getViewSchemas()[0]

    if (!nextSchema) {
      throw new Error("ViewSchema 未创建")
    }

    expect(
      runtime
        .getViewSchemas()
        .map((schema) => ("name" in schema ? schema.name : undefined))
    ).toEqual(["email"])
    expect(nextSchema.nodeId).not.toBe(firstSchema.nodeId)
    expect(runtime.getNode(firstSchema.nodeId)).toBeUndefined()
    expect(runtime.getNode(nextSchema.nodeId)?.type).toBe("field")
    expect(() => runtime.mount(instance)).toThrow("Schema runtime is already mounted")

    runtime.dispose()
  })

  it("挂载前可以提交配置，首次编译读取最新结果", () => {
    const store = createTestStorePort<{ name?: string }>()

    const runtime = createSchemaRuntime({
      schemas: createSchemas([
        { name: "name", label: "姓名", componentType: "input", initialValue: "Alice" },
      ]),
      store,
      validation: createTestValidationPort(),
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.setConfig({
      schemaConfig: { ...runtime.getSchemaConfig(), readonly: true },
    })
    expect(store.getFieldValue("name")).toBeUndefined()
    expect(runtime.getViewSchemas()).toEqual([])
    runtime.mount({} as SchemxInstance)
    expect(store.getFieldValue("name")).toBe("Alice")
    expect(runtime.getViewSchemas()[0]).toMatchObject({ readonly: true })
    runtime.dispose()
  })

  it("未挂载的 Runtime 可以直接销毁，随后挂载不再创建资源", () => {
    const store = createTestStorePort<{ name?: string }>()

    const register = vi.spyOn(store, "registerFieldPath")

    const runtime = createSchemaRuntime({
      schemas: createSchemas([{ name: "name", label: "姓名", componentType: "input" }]),
      store,
      validation: createTestValidationPort(),
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    runtime.dispose()
    runtime.dispose()
    runtime.mount({} as SchemxInstance)
    expect(runtime.isDisposed()).toBe(true)
    expect(runtime.root.scope.disposed).toBe(true)
    expect(register).not.toHaveBeenCalled()
  })

  it("挂载失败时释放已创建的运行时资源", () => {
    const store = createTestStorePort<{ name?: string }>()

    const error = new Error("register failed")

    vi.spyOn(store, "registerFieldPath").mockImplementation(() => {
      throw error
    })
    const runtime = createSchemaRuntime({
      schemas: createSchemas([{ name: "name", label: "姓名", componentType: "input" }]),
      store,
      validation: createTestValidationPort(),
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    })

    expect(() => runtime.mount({} as SchemxInstance)).toThrow(error)
    expect(runtime.isDisposed()).toBe(true)
    expect(runtime.root.disposed.value).toBe(true)
    expect(runtime.root.scope.disposed).toBe(true)
    expect(runtime.getViewSchemas()).toEqual([])
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
    getArrayStructureHandle() {
      return {
        register() {},
        getKeys() {
          return []
        },
        subscribe() {
          return () => {}
        },
      }
    },
    getFieldValue(name) {
      return values.get(String(name)) as never
    },
    setFieldValue(name, action) {
      const value =
        typeof action === "function"
          ? (action as (previousValue: unknown) => unknown)(values.get(String(name)))
          : action

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
    invalidateFieldArray() {},
  }
}
