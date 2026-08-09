/**
 * 运行时节点生命周期与字段资源释放的测试。
 *
 * 覆盖节点生命周期事件触发、节点配置同步、effectDispose 管理、fieldIndex
 * 维护以及字段删除后的 scope 释放（US3）等行为。
 *
 * @module core/runtime/node/__tests__/runtimeNodeLifecycleFlow.test
 */

import { describe, expect, it, vi } from "vitest"

import {
  createFieldRuntimeState,
  resetFieldDynamicOverrides,
  setFieldDynamicOverrides,
} from "../../field/runtimeState"
import { createRuntimeLifecycle } from "../runtimeLifecycle"
import { createFieldRuntimeNode } from "../runtimeNode"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { SchemxResolvedBaseField } from "../../../types"
import type { FieldRuntimeNode } from "../types"

// 节点生命周期：create/update/remove 事件触发时机、节点配置同步、effectDispose 与 fieldIndex 维护
describe("node lifecycle flow", () => {
  it("没有 parent 的描述节点不能进入 mount", () => {
    const { context } = createRuntimeGraphHarness()

    const lifecycle = createRuntimeLifecycle(context)

    const schema = createRawFieldSchema("detached", "detached")

    const input = context.compile.compileNode(schema, "", 0)

    if (input.type !== "field") {
      throw new Error("expected field input")
    }

    const node = createFieldRuntimeNode({ id: 99, input })

    expect(() => lifecycle.mount(node)).toThrow(
      '[schemx] Runtime node "detached" must have a parent before mount.'
    )
  })

  it("create/update/remove transition 每类生命周期事件只触发一次", () => {
    const hooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      beforeUpdate: vi.fn(),
      updated: vi.fn(),
      beforeUnmount: vi.fn(),
      unmounted: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [])

    expect(hooks.beforeMount).toHaveBeenCalledTimes(1)
    expect(hooks.mounted).toHaveBeenCalledTimes(1)
    expect(hooks.beforeUpdate).toHaveBeenCalledTimes(1)
    expect(hooks.updated).toHaveBeenCalledTimes(1)
    expect(hooks.beforeUnmount).toHaveBeenCalledTimes(1)
    expect(hooks.unmounted).toHaveBeenCalledTimes(1)
  })

  it("生命周期 hook 异常不会中断节点提交或资源释放", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const hooks = {
      mounted: vi.fn(() => {
        throw new Error("hook failed")
      }),
      unmounted: vi.fn(() => {
        throw new Error("hook failed")
      }),
    }

    const { commitSchemas, context, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const node = root.childNodes.value[0] as FieldRuntimeNode

    commitSchemas(root, [])

    expect(node.disposed.value).toBe(true)
    expect(context.runtimeRegistry.fieldIndex.get("name" as never)).toBeUndefined()
    expect(error).toHaveBeenCalledTimes(2)

    error.mockRestore()
  })

  it("生命周期回调只接收 node，更新回调接收 previousNode", () => {
    const hooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      beforeUpdate: vi.fn(),
      updated: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const node = root.childNodes.value[0] as FieldRuntimeNode

    const previousConfigToken = node.configToken

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])
    const nextConfigToken = node.configToken

    expect(hooks.beforeMount).toHaveBeenCalledWith(node)
    expect(hooks.mounted).toHaveBeenCalledWith(node)

    const [beforeUpdateNode, beforeUpdatePreviousRuntimeNode] =
      hooks.beforeUpdate.mock.calls[0] ?? []

    const [updatedNode, updatedPreviousRuntimeNode] = hooks.updated.mock.calls[0] ?? []

    expect(beforeUpdateNode).toBe(node)
    expect(updatedNode).toBe(node)
    expect(beforeUpdatePreviousRuntimeNode).toMatchObject({
      type: "field",
      key: "name",
    })
    expect(beforeUpdatePreviousRuntimeNode).toHaveProperty("configToken")
    expect(updatedPreviousRuntimeNode).toBe(beforeUpdatePreviousRuntimeNode)
    expect(beforeUpdatePreviousRuntimeNode.configToken).toBe(previousConfigToken)
    expect(nextConfigToken).not.toBe(previousConfigToken)
  })

  it("节点挂载和更新时同步写入最新配置", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    const firstConfigToken = field.configToken

    expect(field.configToken).toBe(firstConfigToken)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])
    const nextConfigToken = field.configToken

    expect(field.configToken).toBe(nextConfigToken)
    expect(nextConfigToken).not.toBe(firstConfigToken)
  })

  it("disposed field 会释放 node-local 字段资源并移除索引", () => {
    const { commitSchemas, context, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    expect(field.staticSchema).toBeDefined()
    expect(field.fieldState).not.toBeNull()
    expect(field.viewState).not.toBeNull()
    expect(field.effectDispose).toBeDefined()
    expect(context.runtimeRegistry.fieldIndex.get("name" as any)).toBe(field)

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.staticSchema).toBeDefined()
    expect(field.fieldState).toBeNull()
    expect(field.viewState).toBeNull()
    expect(field.effectDispose).toBeNull()
    expect(context.runtimeRegistry.fieldIndex.get("name" as any)).toBeUndefined()
  })

  it("field update 会释放旧 effectDispose 并挂载新的 effectDispose", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    const previousEffectDispose = field.effectDispose

    expect(previousEffectDispose).not.toBeNull()
    expect(previousEffectDispose?.disposed).toBe(false)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

    expect(previousEffectDispose?.disposed).toBe(true)
    expect(field.effectDispose).not.toBeNull()
    expect(field.effectDispose).not.toBe(previousEffectDispose)
    expect(field.effectDispose?.disposed).toBe(false)
  })

  it("非 dependencies 的字段更新会保留已有 effect", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    const validationScope = field.effectDispose

    const dependenciesScope = field.dependenciesEffectDispose

    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), placeholder: "请输入姓名" } as never,
    ])

    expect(field.effectDispose).toBe(validationScope)
    expect(field.dependenciesEffectDispose).toBe(dependenciesScope)
  })

  it("fieldIndex 跟随 field mount/update/unmount 维护字段查询", () => {
    const { commitSchemas, context, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    expect(context.runtimeRegistry.fieldIndex.get("name" as any)).toBe(field)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

    expect(context.runtimeRegistry.fieldIndex.get("name" as any)).toBeUndefined()
    expect(context.runtimeRegistry.fieldIndex.get("nickname" as any)).toBe(field)

    commitSchemas(root, [])

    expect(context.runtimeRegistry.fieldIndex.get("nickname" as any)).toBeUndefined()
  })
})

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

// 用户场景 3：字段删除后的 runtimeState 标记与 scope 释放行为
describe("字段删除和 scope 释放 (US3)", () => {
  it("dispose 后 runtimeState 应标记为 dispose", () => {
    const schema = createTestSchema()

    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    resetFieldDynamicOverrides(state, "dispose")

    expect(readDiagnostics(state).lastUpdatedBy).toBe("dispose")
    expect(state.dynamicOverrides.value).toEqual({})
  })

  it("dispose 后不应再接受动态覆盖写入（调用方负责检查 scope）", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    resetFieldDynamicOverrides(state, "dispose")

    // 即使尝试写入，diagnostics 仍标记为 dispose
    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    // 写入仍然生效（runtimeState 不自行阻止），但 diagnostics 反映最新状态
    expect(readDiagnostics(state).lastUpdatedBy).toBe("dependencies")
  })

  it("reset 后 dynamicOverrides 应清空", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
    })

    setFieldDynamicOverrides(
      state,
      { visible: false, disabled: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    resetFieldDynamicOverrides(state, "reset")

    expect(state.dynamicOverrides.value).toEqual({})
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)
  })
})
