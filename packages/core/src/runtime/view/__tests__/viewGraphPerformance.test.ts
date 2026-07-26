import { describe, expect, it } from "vitest"
import {
  createFieldRuntimeState,
  setFieldDynamicOverrides,
} from "../../field/runtimeState"

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

// 验证 viewState 性能边界：单字段动态属性变化不触发其他字段 viewSchema 重建、多次覆盖不泄漏、版本号递增
describe("computed viewState 性能边界 (US3)", () => {
  it("单字段动态属性变化不应触发其他字段 viewSchema 重建", () => {
    const schema1 = createTestSchema({ label: "字段A", visible: true })
    const schema2 = createTestSchema({ label: "字段B", visible: true })

    const state1 = createFieldRuntimeState({
      nodeId: 1,
      key: "field-a",
      descriptor: { name: "fieldA" as any, staticSchema: schema1 },
    })
    const state2 = createFieldRuntimeState({
      nodeId: 2,
      key: "field-b",
      descriptor: { name: "fieldB" as any, staticSchema: schema2 },
    })

    // 记录初始 viewSchema
    const view1Before = state1.viewSchema.value
    const view2Before = state2.viewSchema.value

    // 只修改字段A
    setFieldDynamicOverrides(
      state1,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["trigger" as any],
      }
    )

    const view1After = state1.viewSchema.value
    const view2After = state2.viewSchema.value

    // 字段A 的 viewSchema 应变化
    expect(view1After.visible).toBe(false)
    expect(view1After).not.toBe(view1Before)

    // 字段B 的 viewSchema 不应变化（引用复用）
    expect(view2After.visible).toBe(true)
    expect(view2After).toBe(view2Before)
  })

  it("多次动态覆盖写入不应导致 viewSchema 泄漏", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "field" as any, staticSchema: schema },
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
    expect(state.diagnostics.value.version).toBe(100)
  })

  it("diagnostics 版本号应正确递增", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "field" as any, staticSchema: schema },
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
      versions.push(state.diagnostics.value.version)
    }

    // 版本号严格递增
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1])
    }
  })
})
