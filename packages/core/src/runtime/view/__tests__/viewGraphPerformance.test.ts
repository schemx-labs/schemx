import { describe, expect, it } from "vitest"

import {
  createFieldRuntimeSignals,
  setFieldDynamicOverrides,
} from "../../node/__tests__/signalsTestUtils"

import type { SchemxBaseField } from "../../../types"

function createTestSchema(overrides: Partial<SchemxBaseField> = {}): SchemxBaseField {
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
  } as SchemxBaseField
}

function readDiagnostics<T>(state: { diagnostics?: { value: T } }): T {
  if (!state.diagnostics) {
    throw new Error("diagnostics 未启用")
  }

  return state.diagnostics.value
}

// 验证字段有效状态性能边界：单字段变化不触发其他字段 computed 重建、多次覆盖不泄漏、版本号递增。
describe("computed viewSchemas 性能边界 (US3)", () => {
  it("单字段动态属性变化不应触发其他字段有效状态重建", () => {
    const schema1 = createTestSchema({ label: "字段A", visible: true })

    const schema2 = createTestSchema({ label: "字段B", visible: true })

    const state1 = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-a",
      name: "fieldA" as any,
      staticSchema: schema1,
    })

    const state2 = createFieldRuntimeSignals({
      nodeId: 2,
      key: "field-b",
      name: "fieldB" as any,
      staticSchema: schema2,
    })

    const effective1Before = state1.effectiveSchema.value

    const effective2Before = state2.effectiveSchema.value

    // 只修改字段A
    setFieldDynamicOverrides(
      state1,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["trigger" as any],
      }
    )

    const effective1After = state1.effectiveSchema.value

    const effective2After = state2.effectiveSchema.value

    expect(effective1After.visible).toBe(false)
    expect(effective1After).not.toBe(effective1Before)

    expect(effective2After.visible).toBe(true)
    expect(effective2After).toBe(effective2Before)
  })

  it("多次动态覆盖写入不应导致有效状态泄漏", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "field" as any,
      staticSchema: schema,
      debug: true,
    })

    // 多次写入
    for (let i = 0; i < 100; i++) {
      setFieldDynamicOverrides(
        state,
        { visible: i % 2 === 0 },
        {
          source: "dependencies",
          triggerFields: ["trigger" as any],
        }
      )
    }

    // 最终状态正确
    expect(state.effectiveSchema.value.visible).toBe(false)
    expect(readDiagnostics(state).version).toBe(100)
  })

  it("diagnostics 版本号应正确递增", () => {
    const schema = createTestSchema()

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "field" as any,
      staticSchema: schema,
      debug: true,
    })

    const versions: number[] = []

    for (let i = 0; i < 10; i++) {
      setFieldDynamicOverrides(
        state,
        { disabled: i % 2 === 0 },
        {
          source: "dependencies",
          triggerFields: ["trigger" as any],
        }
      )
      versions.push(readDiagnostics(state).version)
    }

    // 版本号严格递增
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1])
    }
  })
})
