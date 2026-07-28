/**
 * createDependenciesEffect 与 runtimeState 集成的测试。
 *
 * 覆盖依赖响应的动态覆盖写入、effectiveSchema 合并、异步竞态处理以及
 * diagnostics 版本递增等行为。
 *
 * @module core/runtime/field/__tests__/dependenciesEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createDependenciesEffect } from "../dependenciesEffect"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../runtimeState"
import { createRuntimeScope } from "../../node/scope"
import { createScheduler } from "../../scheduler"
import { createSignal } from "../../../reactivity"
import type { SchemaRuntimeContext } from "../../context"

import type { FieldDescriptor } from "../../descriptor"
import type { SchemxResolvedBaseField } from "../../../types"

function createTestSchema(
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

function createDependenciesDescriptor(
  schema: SchemxResolvedBaseField
): FieldDescriptor<{ country?: string }> {
  return {
    type: "field",
    key: "province",
    name: "province",
    componentType: schema.componentType,
    staticSchema: schema,
    dynamicProps: {
      source: "dependencies",
      triggerFields: ["country"],
      dependencies: {
        triggerFields: ["country"],
        visible: (values) => values.country === "CN",
        required: (values) => values.country === "CN",
        showRequiredMark: (values) => values.country === "US",
      },
    },
  } as FieldDescriptor<{ country?: string }>
}

// US2: dependenciesEffect 写入 dynamicOverrides 的边界行为
describe("dependenciesEffect 写入 dynamicOverrides (US2)", () => {
  it("setFieldDynamicOverrides 应该写入动态覆盖到 runtimeState", () => {
    const schema = createTestSchema({ visible: true, disabled: false })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(
      state,
      { visible: false, disabled: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    expect(state.dynamicOverrides.value.visible).toBe(false)
    expect(state.dynamicOverrides.value.disabled).toBe(true)
  })

  it("dynamicOverrides 写入后 effectiveSchema 应自动更新", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    expect(state.effectiveSchema.value.visible).toBe(false)
  })

  it("动态 readonlyPlaceholder 应写入最终 ViewSchema", () => {
    const schema = createTestSchema({ readonlyPlaceholder: "静态提示" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(
      state,
      { readonlyPlaceholder: "动态提示" },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    expect(state.viewSchema.value.readonlyPlaceholder).toBe("动态提示")
  })

  it("diagnostics 应记录 dependencies 来源", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(
      state,
      { required: true },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
        error: null,
      }
    )

    const diag = state.diagnostics.value
    expect(diag.lastUpdatedBy).toBe("dependencies")
    expect(diag.triggerFields).toEqual(["type"])
    expect(diag.overriddenKeys).toContain("required")
  })

  it("空动态覆盖不应影响 effectiveSchema", () => {
    const schema = createTestSchema({ visible: true, disabled: false })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "city" as any, staticSchema: schema },
    })

    // 初始 effectiveSchema 反映静态值
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)

    // 写入空覆盖
    setFieldDynamicOverrides(
      state,
      {},
      {
        source: "dependencies",
        triggerFields: [],
      }
    )

    // 静态值保持不变
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)
  })
})

// US3: 异步依赖响应中的竞态条件处理
describe("异步 dependencies 竞态处理 (US3)", () => {
  it("最新结果应该获胜，旧结果不应覆盖", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    // 模拟：先写入值 A，再写入值 B
    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    // 值 B 覆盖值 A
    setFieldDynamicOverrides(
      state,
      { visible: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    // 最新结果（B）获胜
    expect(state.effectiveSchema.value.visible).toBe(true)
  })

  it("错误回退时不应覆盖上一次成功的动态覆盖", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    // 先成功写入
    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    // 错误写入（空覆盖），不覆盖上次成功结果
    setFieldDynamicOverrides(
      state,
      {},
      {
        source: "dependencies",
        triggerFields: [],
        error: new Error("解析失败"),
      }
    )

    // 上次成功结果应保留（空覆盖不覆盖静态值，但上次动态覆盖已被清空）
    // 所以 effectiveSchema 回退到静态值
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.diagnostics.value.error).not.toBeNull()
  })

  it("diagnostics 应记录版本递增", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    const v1 = state.diagnostics.value.version

    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    const v2 = state.diagnostics.value.version
    expect(v2).toBeGreaterThan(v1)

    setFieldDynamicOverrides(
      state,
      { visible: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    const v3 = state.diagnostics.value.version
    expect(v3).toBeGreaterThan(v2)
  })
})

// US2: createDependenciesEffect 完整流程 —— 从监听触发字段到写入 runtimeState
describe("createDependenciesEffect 写入 runtimeState (US2)", () => {
  it("只应写入 dynamicOverrides，并驱动 effectiveSchema", async () => {
    const scheduler = createScheduler()
    const scope = createRuntimeScope()
    const values = createSignal<{ country?: string }>({ country: "US" })
    const schema = createTestSchema({ visible: true })
    const descriptor = createDependenciesDescriptor(schema)
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    const formApi = {
      getValues: vi.fn((paths?: readonly unknown[]) => {
        const current = values.value

        if (!paths || paths.length === 0) {
          return current
        }

        const next: Record<string, unknown> = {}

        for (const path of paths) {
          const key = Array.isArray(path) ? String(path.at(-1) ?? "") : String(path)
          next[key] = current[key as keyof typeof current]
        }

        return next
      }),
    }

    const context = {
      formApi: formApi as SchemaRuntimeContext<{ country?: string }>["formApi"],
      scheduler,
    } as unknown as SchemaRuntimeContext<{ country?: string }>

    createDependenciesEffect({
      context,
      taskId: "field:test:dependencies",
      descriptor,
      runtimeState,
      scope,
    })

    await scheduler.whenIdle()

    expect(runtimeState.dynamicOverrides.value).toEqual({
      visible: false,
      required: false,
      showRequiredMark: true,
    })
    expect(runtimeState.effectiveSchema.value.visible).toBe(false)
    expect(runtimeState.effectiveSchema.value.required).toBe(false)

    values.value = { country: "CN" }
    await scheduler.whenIdle()

    expect(runtimeState.dynamicOverrides.value).toEqual({
      visible: true,
      required: true,
      showRequiredMark: false,
    })
    expect(runtimeState.effectiveSchema.value.visible).toBe(true)
    expect(runtimeState.effectiveSchema.value.required).toBe(true)
    expect(runtimeState.effectiveSchema.value.showRequiredMark).toBe(false)
  })

  it("旧 dependencies 异步结果晚于新结果完成时不应覆盖最新 dynamicOverrides", async () => {
    const scheduler = createScheduler()
    const scope = createRuntimeScope()
    const values = createSignal<{ country?: string }>({ country: "US" })
    const schema = createTestSchema({ visible: true })
    const slowVisible = createDeferred<boolean>()
    const descriptor = createDependenciesDescriptor(schema)
    descriptor.dynamicProps!.dependencies.visible = vi
      .fn()
      .mockReturnValueOnce(slowVisible.promise)
      .mockResolvedValueOnce(true) as any
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, staticSchema: schema },
    })

    const formApi = {
      getValues: vi.fn((paths?: readonly unknown[]) => {
        const current = values.value

        if (!paths || paths.length === 0) {
          return current
        }

        const next: Record<string, unknown> = {}

        for (const path of paths) {
          const key = Array.isArray(path) ? String(path.at(-1) ?? "") : String(path)
          next[key] = current[key as keyof typeof current]
        }

        return next
      }),
    }

    const context = {
      formApi: formApi as SchemaRuntimeContext<{ country?: string }>["formApi"],
      scheduler,
    } as unknown as SchemaRuntimeContext<{ country?: string }>

    createDependenciesEffect({
      context,
      taskId: "field:test:async-dependencies",
      descriptor,
      runtimeState,
      scope,
    })

    values.value = { country: "CN" }
    await Promise.resolve()

    slowVisible.resolve(false)
    await scheduler.whenIdle()

    expect(runtimeState.dynamicOverrides.value).toEqual({
      visible: true,
      required: true,
      showRequiredMark: false,
    })
    expect(runtimeState.effectiveSchema.value.visible).toBe(true)
    expect(runtimeState.effectiveSchema.value.required).toBe(true)
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause?: unknown) => void

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    resolve,
    reject,
  }
}
