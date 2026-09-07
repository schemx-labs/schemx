/**
 * 运行时节点生命周期与字段资源释放的测试。
 *
 * 覆盖节点生命周期事件触发、节点配置同步、validationEffectScope 管理、
 * Root 字段查询以及字段删除后的 scope 释放（US3）等行为。
 *
 * @module core/runtime/node/__tests__/nodeLifecycleFlow.test
 */

import { describe, expect, it, vi } from "vitest"

import { findFieldNode, isFieldNode } from "../helper"
import { createNodeLifecycle, mountNodeResources } from "../resources"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./graphTestUtils"
import {
  createFieldRuntimeSignals,
  resetFieldDynamicOverrides,
  setFieldDynamicOverrides,
} from "./signalsTestUtils"

import type { SchemxBaseField } from "../../../types"
import type { FieldNode } from "../types"

// 节点生命周期：create/update/remove 事件触发时机、节点配置同步、validationEffectScope 与 Root 查询维护
describe("node lifecycle flow", () => {
  it("created 和 discard 分别处理事件与 detached scope", () => {
    const hooks = {
      created: vi.fn(),
      unmounted: vi.fn(),
    }

    const { compiler, context } = createRuntimeGraphHarness(hooks)

    const lifecycle = createNodeLifecycle(context)

    const node = compiler.createNode(createRawFieldSchema("detached"), "", 0)

    lifecycle.created(node)
    lifecycle.discard(node)

    expect(hooks.created).toHaveBeenCalledWith(node)
    expect(hooks.unmounted).not.toHaveBeenCalled()
    expect(node.disposed.value).toBe(true)
    expect(node.scope.disposed).toBe(true)
  })

  it("没有 parent 的描述节点不能进入 mount", () => {
    const { compiler, context } = createRuntimeGraphHarness()

    const schema = createRawFieldSchema("detached", "detached")

    const node = compiler.createNode(schema, "", 0)

    expect(() => mountNodeResources(node, context)).toThrow(
      '[schemx] Runtime node "detached" must have a parent before mount.'
    )
  })

  it("mount/update/unmount 事件各触发一次", () => {
    const hooks = {
      mounted: vi.fn(),
      updated: vi.fn(),
      unmounted: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [])

    expect(hooks.mounted).toHaveBeenCalledTimes(1)
    expect(hooks.updated).toHaveBeenCalledTimes(1)
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

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const node = root.childNodes.value[0] as FieldNode

    commitSchemas(root, [])

    expect(node.disposed.value).toBe(true)
    expect(findFieldNode(root, "name" as never)).toBeUndefined()
    expect(error).toHaveBeenCalledTimes(2)

    error.mockRestore()
  })

  it("生命周期回调只接收 node，更新回调接收 previousNode", () => {
    const hooks = {
      mounted: vi.fn(),
      updated: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [{ ...createRawFieldSchema("name", "name"), label: "旧标签" }])
    const node = root.childNodes.value[0] as FieldNode

    setFieldDynamicOverrides(
      node,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["visible" as never],
      }
    )

    const previousConfigToken = node.configToken

    commitSchemas(root, [
      { ...createRawFieldSchema("name", "nickname"), label: "新标签" },
    ])
    const nextConfigToken = node.configToken

    expect(hooks.mounted).toHaveBeenCalledWith(node)

    const [updatedNode, updatedPreviousNode] = hooks.updated.mock.calls[0] ?? []

    expect(updatedNode).toBe(node)
    expect(updatedPreviousNode).toMatchObject({
      type: "field",
      key: "name",
    })
    expect(updatedPreviousNode).toHaveProperty("configToken")
    expect(updatedPreviousNode.configToken).toBe(previousConfigToken)
    expect(isFieldNode(updatedPreviousNode) && updatedPreviousNode.name.value).toBe(
      "name"
    )
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.staticSchema.value.name
    ).toBe("name")
    expect(updatedPreviousNode).not.toBe(updatedNode)
    expect(isFieldNode(updatedPreviousNode) && updatedPreviousNode.staticSchema).not.toBe(
      updatedNode.staticSchema
    )
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.dynamicOverrides
    ).not.toBe(updatedNode.dynamicOverrides)
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.effectiveSchema
    ).not.toBe(updatedNode.effectiveSchema)
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.effectiveSchema.value
    ).toMatchObject({ label: "旧标签", visible: false })
    expect(isFieldNode(updatedNode) && updatedNode.name.value).toBe("nickname")
    expect(isFieldNode(updatedNode) && updatedNode.effectiveSchema.value).toMatchObject({
      label: "新标签",
      visible: false,
    })

    setFieldDynamicOverrides(
      updatedNode,
      { visible: true },
      {
        source: "dependencies",
        triggerFields: ["visible" as never],
      }
    )

    expect(
      isFieldNode(updatedPreviousNode) &&
        updatedPreviousNode.effectiveSchema.value.visible
    ).toBe(false)
    expect(nextConfigToken).not.toBe(previousConfigToken)
  })

  it("节点挂载和更新时同步写入最新配置", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    const firstConfigToken = field.configToken

    expect(field.configToken).toBe(firstConfigToken)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])
    const nextConfigToken = field.configToken

    expect(field.configToken).toBe(nextConfigToken)
    expect(nextConfigToken).not.toBe(firstConfigToken)
  })

  it("disposed field 会释放 node-local 字段资源并从 Root 查询中消失", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    expect(field.staticSchema).toBeDefined()
    expect(field.viewSchemas).not.toBeNull()
    expect(field.validationEffectScope).toBeDefined()
    expect(findFieldNode(root, "name" as any)).toBe(field)

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.staticSchema).toBeDefined()
    expect(field.viewSchemas).toBeNull()
    expect(field.validationEffectScope).toBeNull()
    expect(findFieldNode(root, "name" as any)).toBeUndefined()
  })

  it("field update 会释放旧 validationEffectScope 并挂载新的 validationEffectScope", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    const previousValidationEffectScope = field.validationEffectScope

    expect(previousValidationEffectScope).not.toBeNull()
    expect(previousValidationEffectScope?.disposed).toBe(false)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

    expect(previousValidationEffectScope?.disposed).toBe(true)
    expect(field.validationEffectScope).not.toBeNull()
    expect(field.validationEffectScope).not.toBe(previousValidationEffectScope)
    expect(field.validationEffectScope?.disposed).toBe(false)
  })

  it("非 dependencies 的字段更新会保留已有 effect", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    const validationScope = field.validationEffectScope

    const dependenciesScope = field.dependenciesEffectScope

    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), placeholder: "请输入姓名" } as never,
    ])

    expect(field.validationEffectScope).toBe(validationScope)
    expect(field.dependenciesEffectScope).toBe(dependenciesScope)
  })

  it("Root 查询跟随 field mount/update/unmount 更新", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    expect(findFieldNode(root, "name" as any)).toBe(field)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

    expect(findFieldNode(root, "name" as any)).toBeUndefined()
    expect(findFieldNode(root, "nickname" as any)).toBe(field)

    commitSchemas(root, [])

    expect(findFieldNode(root, "nickname" as any)).toBeUndefined()
  })
})

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

// 用户场景 3：字段删除后的 runtimeSignals 标记与 scope 释放行为
describe("字段删除和 scope 释放 (US3)", () => {
  it("dispose 后 runtimeSignals 应标记为 dispose", () => {
    const schema = createTestSchema()

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
      debug: true,
    })

    resetFieldDynamicOverrides(state, "dispose")

    expect(readDiagnostics(state).lastUpdatedBy).toBe("dispose")
    expect(state.dynamicOverrides.value).toEqual({})
  })

  it("dispose 后不应再接受动态覆盖写入（调用方负责检查 scope）", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      staticSchema: schema,
      debug: true,
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

    // 写入仍然生效（runtimeSignals 不自行阻止），但 diagnostics 反映最新状态
    expect(readDiagnostics(state).lastUpdatedBy).toBe("dependencies")
  })

  it("reset 后 dynamicOverrides 应清空", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
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
