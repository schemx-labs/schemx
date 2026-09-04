/**
 * FieldRuntimeSignals 的单元测试。
 *
 * 覆盖 runtimeSignals 的创建、staticSchema/dynamicOverrides/effectiveSchema
 * 三层合并，以及 setFieldStaticSchema、setFieldDynamicOverrides、
 * resetFieldDynamicOverrides 等操作。
 *
 * @module core/runtime/field/__tests__/runtimeSignals.test
 */

import { describe, expect, it } from "vitest"

import {
  createFieldRuntimeSignals,
  resetFieldDynamicOverrides,
  setFieldDynamicOverrides,
  setFieldStaticSchema,
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

// 字段运行态各层次的创建与初始状态
describe("FieldRuntimeSignals", () => {
  describe("createFieldRuntimeSignals", () => {
    it("应该创建包含所有层次的字段运行态", () => {
      const schema = createTestSchema()

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: schema,
        debug: true,
      })

      expect(state.staticSchema).toBeDefined()
      expect(state.dynamicOverrides).toBeDefined()
      expect(state.effectiveSchema).toBeDefined()
      expect(state.diagnostics).toBeDefined()
    })

    it("不应暴露运行时内部隐藏字段", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: createTestSchema(),
        debug: true,
      })

      expect("_currentName" in state).toBe(false)
    })

    it("未启用 debug 时不创建 diagnostics", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: createTestSchema(),
      })

      expect(state.diagnostics).toBeUndefined()
    })

    it("初始 staticSchema 应该等于传入的静态 schema", () => {
      const schema = createTestSchema({ label: "用户名" })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: schema,
      })

      expect(state.staticSchema.value).toMatchObject(schema)
      expect(state.staticSchema.value.dependencies).toBeUndefined()
    })

    it("初始 dynamicOverrides 应该为空对象", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: createTestSchema(),
      })

      expect(state.dynamicOverrides.value).toEqual({})
    })

    it("初始 diagnostics 来源应为 static-schema", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "username" as any,
        staticSchema: createTestSchema(),
        debug: true,
      })

      expect(readDiagnostics(state).lastUpdatedBy).toBe("static-schema")
      expect(readDiagnostics(state).version).toBe(0)
    })
  })

  describe("effectiveSchema", () => {
    it("应该合并静态 schema 和默认值", () => {
      const schema = createTestSchema({
        label: "邮箱",
        visible: true,
        disabled: false,
        required: true,
      })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
        debug: true,
      })

      const effective = state.effectiveSchema.value

      expect(effective.label).toBe("邮箱")
      expect(effective.visible).toBe(true)
      expect(effective.disabled).toBe(false)
      expect(effective.required).toBe(true)
    })

    it("动态覆盖应该覆盖静态 schema", () => {
      const schema = createTestSchema({ visible: true, disabled: false })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
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

      const effective = state.effectiveSchema.value

      expect(effective.visible).toBe(false)
      expect(effective.disabled).toBe(true)
    })

    it("required=true 且未配置标记时应该默认显示必填标记", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema({ required: true }),
      })

      expect(state.effectiveSchema.value.showRequiredMark).toBe(true)
    })

    it("静态 showRequiredMark=false 应隐藏标记但保留 required", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema({ required: true, showRequiredMark: false }),
      })

      expect(state.effectiveSchema.value.showRequiredMark).toBe(false)
      expect(state.effectiveSchema.value.required).toBe(true)
    })

    it("未配置 showRequiredMark 时应该跟随动态 required", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema({ required: false }),
      })

      expect(state.effectiveSchema.value.showRequiredMark).toBe(false)

      setFieldDynamicOverrides(
        state,
        { required: { message: "请输入邮箱" } },
        { source: "dependencies", triggerFields: ["country" as any] }
      )

      expect(state.effectiveSchema.value.showRequiredMark).toBe(true)
    })

    it("动态 showRequiredMark 应覆盖标记但不改变 required", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema({ required: true }),
      })

      setFieldDynamicOverrides(
        state,
        { showRequiredMark: false },
        { source: "dependencies", triggerFields: ["country" as any] }
      )

      expect(state.effectiveSchema.value.showRequiredMark).toBe(false)
      expect(state.effectiveSchema.value.required).toBe(true)
    })

    it("部分动态覆盖不应影响未覆盖的静态属性", () => {
      const schema = createTestSchema({ visible: true, disabled: false, readonly: false })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
        debug: true,
      })

      setFieldDynamicOverrides(
        state,
        { disabled: true },
        {
          source: "dependencies",
          triggerFields: ["country" as any],
        }
      )

      const effective = state.effectiveSchema.value

      expect(effective.visible).toBe(true) // 未覆盖
      expect(effective.disabled).toBe(true) // 已覆盖
      expect(effective.readonly).toBe(false) // 未覆盖
    })
  })

  describe("setFieldStaticSchema", () => {
    it("应该更新 staticSchema", () => {
      const schema = createTestSchema({ label: "旧标签" })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
      })

      const newSchema = createTestSchema({ label: "新标签" })

      setFieldStaticSchema(state, {
        name: "email" as any,
        staticSchema: newSchema,
      })

      expect(state.staticSchema.value.label).toBe("新标签")
    })

    it("应该更新 effectiveSchema.name", () => {
      const schema = createTestSchema({ label: "旧标签" })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "oldName" as any,
        staticSchema: schema,
      })

      setFieldStaticSchema(state, {
        name: "newName" as any,
        staticSchema: createTestSchema({ label: "新标签" }),
      })

      expect(state.effectiveSchema.value.name).toBe("newName")
    })

    it("更新 staticSchema 不应清空 dynamicOverrides", () => {
      const schema = createTestSchema({ visible: true })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
      })

      setFieldDynamicOverrides(
        state,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["country" as any],
        }
      )

      const newSchema = createTestSchema({ visible: true, label: "新标签" })

      setFieldStaticSchema(state, {
        name: "email" as any,
        staticSchema: newSchema,
      })

      // dynamicOverrides 应保留
      expect(state.dynamicOverrides.value.visible).toBe(false)
      // staticSchema 应更新
      expect(state.staticSchema.value.label).toBe("新标签")
    })

    it("应该更新 diagnostics", () => {
      const schema = createTestSchema()

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
        debug: true,
      })

      const prevVersion = readDiagnostics(state).version

      setFieldStaticSchema(state, {
        name: "email" as any,
        staticSchema: createTestSchema({ label: "新" }),
      })

      expect(readDiagnostics(state).lastUpdatedBy).toBe("static-schema")
      expect(readDiagnostics(state).version).toBe(prevVersion + 1)
    })
  })

  describe("setFieldDynamicOverrides", () => {
    it("应该写入动态覆盖", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema(),
      })

      setFieldDynamicOverrides(
        state,
        { placeholder: "动态占位" },
        {
          source: "dependencies",
          triggerFields: ["type" as any],
        }
      )

      expect(state.dynamicOverrides.value.placeholder).toBe("动态占位")
    })

    it("应该更新 diagnostics 记录来源和触发字段", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema(),
        debug: true,
      })

      setFieldDynamicOverrides(
        state,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["country" as any, "city" as any],
        }
      )

      const diag = readDiagnostics(state)

      expect(diag.lastUpdatedBy).toBe("dependencies")
      expect(diag.triggerFields).toEqual(["country", "city"])
      expect(diag.overriddenKeys).toContain("visible")
    })

    it("空对象表示当前没有动态覆盖", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema(),
      })

      setFieldDynamicOverrides(
        state,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["country" as any],
        }
      )
      setFieldDynamicOverrides(
        state,
        {},
        {
          source: "dependencies",
          triggerFields: [],
        }
      )

      expect(state.dynamicOverrides.value).toEqual({})
    })
  })

  describe("resetFieldDynamicOverrides", () => {
    it("应该清空 dynamicOverrides", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema(),
      })

      setFieldDynamicOverrides(
        state,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["country" as any],
        }
      )
      resetFieldDynamicOverrides(state, "reset")

      expect(state.dynamicOverrides.value).toEqual({})
    })

    it("应该更新 diagnostics", () => {
      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: createTestSchema(),
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
      resetFieldDynamicOverrides(state, "dispose")

      expect(readDiagnostics(state).lastUpdatedBy).toBe("dispose")
    })

    it("不应修改 staticSchema", () => {
      const schema = createTestSchema({ label: "原始标签" })

      const state = createFieldRuntimeSignals({
        nodeId: 1,
        key: "field-1",
        name: "email" as any,
        staticSchema: schema,
      })

      setFieldDynamicOverrides(
        state,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["country" as any],
        }
      )
      resetFieldDynamicOverrides(state)

      expect(state.staticSchema.value.label).toBe("原始标签")
    })
  })
})

// effectiveSchema 合并逻辑：静态 schema、动态覆盖与默认值的多层合并
describe("effectiveSchema 合并逻辑 (US1)", () => {
  it("应该合并静态 schema、动态覆盖和默认值", () => {
    const formatRule = { validate: () => ({ valid: true }) as const }

    const schema = createTestSchema({
      label: "邮箱",
      visible: true,
      disabled: false,
      readonly: false,
      required: true,
      placeholder: "请输入邮箱",
      componentProps: { type: "email" } as any,
      rules: [formatRule],
    })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    const effective = state.effectiveSchema.value

    expect(effective.key).toBe("field-1")
    expect(effective.name).toBe("email")
    expect(effective.componentType).toBe("input")
    expect(effective.label).toBe("邮箱")
    expect(effective.visible).toBe(true)
    expect(effective.disabled).toBe(false)
    expect(effective.readonly).toBe(false)
    expect(effective.required).toBe(true)
    expect(effective.placeholder).toBe("请输入邮箱")
    expect(effective.componentProps).toEqual({ type: "email" })
    expect(effective.rules).toEqual([formatRule])
    expect(effective.validationTrigger).toBe("onChange")
  })

  it("动态覆盖 rules 应覆盖静态 rules", () => {
    const staticRule = { validate: () => ({ valid: true }) as const }

    const dynamicRule = { validate: () => ({ valid: false, issues: [] }) as const }

    const schema = createTestSchema({ rules: [staticRule] })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    setFieldDynamicOverrides(
      state,
      { rules: [dynamicRule] },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
      }
    )

    expect(state.effectiveSchema.value.rules).toEqual([dynamicRule])
  })

  it("动态覆盖 componentProps 应覆盖静态 componentProps", () => {
    const formInstance = { id: "form" }

    const schema = createTestSchema({
      componentProps: {
        size: "small",
        formInstance,
        formItemProps: {
          name: "email",
          label: "邮箱",
          componentType: "input",
          disabled: false,
          readonly: false,
          placeholder: "请输入",
        },
      } as any,
    })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    setFieldDynamicOverrides(
      state,
      {
        componentProps: {
          size: "large",
          formInstance: { id: "dynamic" },
          formItemProps: { name: "dynamic" },
        } as any,
      },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
      }
    )

    expect(state.effectiveSchema.value.componentProps).toMatchObject({
      size: "large",
      formInstance,
      disabled: false,
      readonly: false,
      placeholder: "请输入",
      formItemProps: {
        name: "email",
        label: "邮箱",
        componentType: "input",
        disabled: false,
        readonly: false,
        placeholder: "请输入",
      },
    })
  })

  it("动态展示属性应同步到 componentProps 和 formItemProps", () => {
    const schema = createTestSchema({
      readonlyPlaceholder: "暂无内容",
      componentProps: {
        disabled: false,
        readonly: false,
        placeholder: "请输入",
        readonlyPlaceholder: "暂无内容",
        formItemProps: {
          name: "email",
          label: "邮箱",
          componentType: "input",
          disabled: false,
          readonly: false,
          placeholder: "请输入",
          readonlyPlaceholder: "暂无内容",
        },
      },
    })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    setFieldDynamicOverrides(
      state,
      {
        disabled: true,
        readonly: true,
        placeholder: "动态占位",
        readonlyPlaceholder: "动态空值",
      },
      {
        source: "dependencies",
        triggerFields: ["type" as any],
      }
    )

    expect(state.effectiveSchema.value.componentProps).toMatchObject({
      disabled: true,
      readonly: true,
      placeholder: "动态占位",
      readonlyPlaceholder: "动态空值",
      formItemProps: {
        disabled: true,
        readonly: true,
        placeholder: "动态占位",
        readonlyPlaceholder: "动态空值",
      },
    })
  })

  it("effectiveSchema 应反映动态覆盖的合并结果", () => {
    const schema = createTestSchema({ visible: true, label: "原始" })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    setFieldDynamicOverrides(state, { visible: false, label: "动态" as any } as never, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    const effective = state.effectiveSchema.value

    expect(effective.visible).toBe(false)
    // label 不是动态覆盖 key，应保持静态值
  })
})
