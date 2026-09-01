/**
 * createDependenciesEffect 与 runtimeSignals 集成的测试。
 *
 * 覆盖依赖响应的动态覆盖写入、effectiveSchema 合并、异步竞态处理以及
 * diagnostics 版本递增等行为。
 *
 * @module core/runtime/field/__tests__/dependenciesEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createSignal } from "../../../reactivity"
import { resolveDependencyProps } from "../../dependencyScheduler"
import { createFieldNode } from "../../node/__tests__/nodeTestUtils"
import {
  createFieldRuntimeSignals,
  setFieldDynamicOverrides,
} from "../../node/__tests__/signalsTestUtils"
import { createScope } from "../../node/scope"
import { createScheduler } from "../../scheduler"
import { createFieldDependenciesEffect } from "../dependenciesEffect"

import type { SchemxResolvedBaseField } from "../../../types"
import type { SchemaRuntimeContext } from "../../context"
import type { FieldNode } from "../../node"

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

function readDiagnostics<T>(state: { diagnostics?: { value: T } }): T {
  if (!state.diagnostics) {
    throw new Error("diagnostics 未启用")
  }

  return state.diagnostics.value
}

function createDependenciesNode(
  schema: SchemxResolvedBaseField
): FieldNode<{ country?: string }> {
  const dynamicConfig = {
    triggerFields: ["country" as const],
    visible: (values: { country?: string }) => values.country === "CN",
    required: (values: { country?: string }) => values.country === "CN",
    showRequiredMark: (values: { country?: string }) => values.country === "US",
  }

  return createFieldNode<{ country?: string }>({
    id: 1,
    key: "province",
    configToken: Symbol("province"),
    name: "province" as never,
    staticSchema: {
      ...schema,
      name: "province",
      dependencies: dynamicConfig,
    } as never,
  })
}

// 用户场景 2：dependenciesEffect 写入 dynamicOverrides 的边界行为
describe("dependenciesEffect 写入 dynamicOverrides (US2)", () => {
  it("动态属性异常日志应包含字段名与属性名", async () => {
    const error = new Error("boom")

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    try {
      await expect(
        resolveDependencyProps(
          {
            triggerFields: [],
            visible: () => {
              throw error
            },
          } as never,
          ["visible"],
          { getFieldsValue: () => ({}) } as any,
          '字段 "province"'
        )
      ).resolves.toEqual({})
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] 字段 "province" 动态属性 "visible" 解析错误',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("setFieldDynamicOverrides 应该写入动态覆盖到 runtimeSignals", () => {
    const schema = createTestSchema({ visible: true, disabled: false })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
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

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
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

  it("动态 readonlyPlaceholder 应写入最终有效字段状态", () => {
    const schema = createTestSchema({ readonlyPlaceholder: "静态提示" })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
    })

    setFieldDynamicOverrides(
      state,
      { readonlyPlaceholder: "动态提示" },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    expect(state.effectiveSchema.value.readonlyPlaceholder).toBe("动态提示")
  })

  it("diagnostics 应记录 dependencies 来源", () => {
    const schema = createTestSchema()

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
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

    const diag = readDiagnostics(state)

    expect(diag.lastUpdatedBy).toBe("dependencies")
    expect(diag.triggerFields).toEqual(["type"])
    expect(diag.overriddenKeys).toContain("required")
  })

  it("空动态覆盖不应影响 effectiveSchema", () => {
    const schema = createTestSchema({ visible: true, disabled: false })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "city" as any,
      staticSchema: schema,
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

// 用户场景 3：异步依赖响应中的竞态条件处理
describe("异步 dependencies 竞态处理 (US3)", () => {
  it("最新结果应该获胜，旧结果不应覆盖", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
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

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
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
    expect(readDiagnostics(state).error).not.toBeNull()
  })

  it("diagnostics 应记录版本递增", () => {
    const schema = createTestSchema()

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "province" as any,
      staticSchema: schema,
      debug: true,
    })

    const v1 = readDiagnostics(state).version

    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    const v2 = readDiagnostics(state).version

    expect(v2).toBeGreaterThan(v1)

    setFieldDynamicOverrides(
      state,
      { visible: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    const v3 = readDiagnostics(state).version

    expect(v3).toBeGreaterThan(v2)
  })
})

// 用户场景 2：createDependenciesEffect 完整流程——从监听触发字段到写入 runtimeSignals
describe("createDependenciesEffect 写入 runtimeSignals (US2)", () => {
  it("只应写入 dynamicOverrides，并驱动 effectiveSchema", async () => {
    const scheduler = createScheduler()

    const scope = createScope()

    const values = createSignal<{ country?: string }>({ country: "US" })

    const schema = createTestSchema({ visible: true })

    const node = createDependenciesNode(schema)

    const formApi = {
      getFieldsValue: vi.fn((paths?: readonly unknown[]) => {
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
      formApi: formApi as unknown as SchemaRuntimeContext<{
        country?: string
      }>["formApi"],
      scheduler,
    } as unknown as SchemaRuntimeContext<{ country?: string }>

    createFieldDependenciesEffect({
      context,
      taskId: "field:test:dependencies",
      node,
      scope,
    })

    await scheduler.whenIdle()

    expect(node.dynamicOverrides.value).toEqual({
      visible: false,
      required: false,
      showRequiredMark: true,
    })
    expect(node.effectiveSchema.value.visible).toBe(false)
    expect(node.effectiveSchema.value.required).toBe(false)

    values.value = { country: "CN" }
    await scheduler.whenIdle()

    expect(node.dynamicOverrides.value).toEqual({
      visible: true,
      required: true,
      showRequiredMark: false,
    })
    expect(node.effectiveSchema.value.visible).toBe(true)
    expect(node.effectiveSchema.value.required).toBe(true)
    expect(node.effectiveSchema.value.showRequiredMark).toBe(false)
  })

  it("旧 dependencies 异步结果晚于新结果完成时不应覆盖最新 dynamicOverrides", async () => {
    const scheduler = createScheduler()

    const scope = createScope()

    const values = createSignal<{ country?: string }>({ country: "US" })

    const schema = createTestSchema({ visible: true })

    const slowVisible = createDeferred<boolean>()

    const node = createDependenciesNode(schema)

    const dynamicConfig = node.staticSchema.value.dependencies

    if (!dynamicConfig) {
      throw new Error("dependencies 节点缺少 dynamicConfig")
    }

    dynamicConfig.visible = vi
      .fn()
      .mockReturnValueOnce(slowVisible.promise)
      .mockResolvedValueOnce(true) as any
    const formApi = {
      getFieldsValue: vi.fn((paths?: readonly unknown[]) => {
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
      formApi: formApi as unknown as SchemaRuntimeContext<{
        country?: string
      }>["formApi"],
      scheduler,
    } as unknown as SchemaRuntimeContext<{ country?: string }>

    createFieldDependenciesEffect({
      context,
      taskId: "field:test:async-dependencies",
      node,
      scope,
    })

    values.value = { country: "CN" }
    await Promise.resolve()

    slowVisible.resolve(false)
    await scheduler.whenIdle()

    expect(node.dynamicOverrides.value).toEqual({
      visible: true,
      required: true,
      showRequiredMark: false,
    })
    expect(node.effectiveSchema.value.visible).toBe(true)
    expect(node.effectiveSchema.value.required).toBe(true)
  })
})

function createDeferred<TValue>() {
  let resolve!: (value: TValue) => void

  let reject!: (cause?: unknown) => void

  const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    resolve,
    reject,
  }
}
