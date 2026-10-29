/**
 * 运行时节点生命周期与字段资源释放的测试。
 *
 * 覆盖节点生命周期事件触发、节点配置同步、validationEffectScope 管理、
 * Root 字段查询以及字段删除后的 scope 释放（US3）等行为。
 *
 * @module core/node/__tests__/nodeLifecycleFlow.test
 */

import { describe, expect, it, vi } from "vite-plus/test"

import {
  createScope,
  disposeNodeResources,
  findFieldNode,
  isDynamicNode,
  isFieldNode,
  mountNodeResources,
  unmountNodeResources,
} from ".."
import { createFormConfig } from "../../config/createFormConfig"
import { createLifecycle } from "../../lifecycle"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./graphTestUtils"
import {
  createFieldRuntimeSignals,
  resetFieldDependencyOverrides,
  setFieldDependencyOverrides,
} from "./signalsTestUtils"

import type { FieldNode } from ".."
import type { SchemxBaseField } from "../../types"

// 节点生命周期：create/update/remove 事件触发时机、节点配置同步、validationEffectScope 与 Root 查询维护
describe("node lifecycle flow", () => {
  it("created 通知与 detached scope 释放相互独立", () => {
    const hooks = {
      created: vi.fn(),
      unmounted: vi.fn(),
    }

    const { compiler } = createRuntimeGraphHarness(hooks)

    const lifecycle = createLifecycle(hooks)

    const node = compiler.createNode(
      compiler.compile(createRawFieldSchema("detached"), "", 0),
      createScope()
    )

    lifecycle.created(node)
    disposeNodeResources(node)

    expect(hooks.created).toHaveBeenCalledWith(node)
    expect(hooks.unmounted).not.toHaveBeenCalled()
    expect(node.disposed.value).toBe(true)
    expect(node.scope.disposed).toBe(true)
  })

  it("没有 parent 的描述节点不能进入 mount", () => {
    const { compiler, context, reconciler } = createRuntimeGraphHarness()

    const schema = createRawFieldSchema("detached", "detached")

    const node = compiler.createNode(compiler.compile(schema, "", 0), createScope())

    expect(() => mountNodeResources(node, context, reconciler)).toThrow(
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

    const { commitSchemas, root, compiler } = createRuntimeGraphHarness(hooks)

    // 开启真实字段 diagnostics，覆盖快照中的可选 Signal。
    const configuration = createFormConfig({ config: { debug: true } })

    compiler.setConfig(configuration.getConfig())
    configuration.dispose()
    commitSchemas(root, [{ ...createRawFieldSchema("name", "name"), label: "旧标签" }])
    const node = root.childNodes.value[0] as FieldNode

    setFieldDependencyOverrides(
      node,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: ["visible" as never],
      }
    )

    const previousConfigToken = node.configToken

    // 记录更新前的校验切片和诊断值，后续活动节点变化不能改写它们。
    const previousValidationState = node.validationState.peek()

    const previousDiagnostics = node.diagnostics?.peek()

    expect(previousDiagnostics).toBeDefined()

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
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.compiledSchema.value.name
    ).toBe("name")
    expect(updatedPreviousNode).not.toBe(updatedNode)
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.compiledSchema
    ).not.toBe(updatedNode.compiledSchema)
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.dependencyOverrides
    ).not.toBe(updatedNode.dependencyOverrides)
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.resolvedSchema
    ).not.toBe(updatedNode.resolvedSchema)
    expect(updatedPreviousNode.validationState).not.toBe(updatedNode.validationState)
    expect(updatedPreviousNode.validationState.peek()).toBe(previousValidationState)
    expect(updatedPreviousNode.diagnostics).not.toBe(updatedNode.diagnostics)
    expect(updatedPreviousNode.diagnostics.peek()).toBe(previousDiagnostics)
    expect(updatedPreviousNode).not.toHaveProperty("staticSchema")
    expect(updatedPreviousNode).not.toHaveProperty("dynamicOverrides")
    expect(updatedPreviousNode).not.toHaveProperty("effectiveSchema")
    expect(updatedPreviousNode).not.toHaveProperty("validationSchema")
    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.resolvedSchema.value
    ).toMatchObject({ label: "旧标签", visible: false })
    expect(isFieldNode(updatedNode) && updatedNode.name.value).toBe("nickname")
    expect(isFieldNode(updatedNode) && updatedNode.resolvedSchema.value).toMatchObject({
      label: "新标签",
      visible: false,
    })

    setFieldDependencyOverrides(
      updatedNode,
      { visible: true },
      {
        source: "dependencies",
        triggerFields: ["visible" as never],
      }
    )

    expect(
      isFieldNode(updatedPreviousNode) && updatedPreviousNode.resolvedSchema.value.visible
    ).toBe(false)
    expect(updatedPreviousNode.validationState.peek().visible).toBe(false)
    expect(updatedPreviousNode.diagnostics.peek()).toBe(previousDiagnostics)
    expect(nextConfigToken).not.toBe(previousConfigToken)
  })

  it.each([
    { kind: "Group", schema: { key: "container", label: "旧标签", children: [] } },
    {
      kind: "Dependency",
      schema: { key: "container", label: "旧标签", to: ["trigger"], renderer: () => [] },
    },
    {
      kind: "Dynamic",
      schema: { key: "container", label: "旧标签", name: "users", item: [] },
    },
  ])("$kind 更新快照隔离配置和呈现态，资源句柄沿用原引用", ({ schema }) => {
    // schema 分别覆盖三类容器，updated 保存回调实际收到的旧节点。
    const hooks = { updated: vi.fn() }

    const { commitSchemas, root, context, reconciler } = createRuntimeGraphHarness(hooks)

    context.store.setFieldValue("users", [{ name: "Ada" }])
    commitSchemas(root, [schema])

    // 当前活动容器具有呈现态，数组容器还具有独立行结构。
    const node = root.childNodes.peek()[0]

    if (!node || isFieldNode(node)) {
      throw new Error("容器节点未挂载")
    }

    node.dependencyOverrides.value = { visible: false }

    // 旧 Scope 和配置令牌需要保留在快照中。
    const scope = node.scope

    const token = node.configToken

    try {
      commitSchemas(root, [{ ...schema, label: "新标签", disabled: true }])

      // updated 的第二个参数必须独立保存更新前的配置值。
      const previous = hooks.updated.mock.calls[0]?.[1]

      expect(previous).toBeDefined()
      expect(previous).not.toBe(node)
      expect(previous.scope).toBe(scope)
      expect(previous.configToken).toBe(token)
      expect(previous.compiledSchema).not.toBe(node.compiledSchema)
      expect(previous.dependencyOverrides).not.toBe(node.dependencyOverrides)
      expect(previous.presentationState).not.toBe(node.presentationState)
      expect(previous.compiledSchema.peek().label).toBe("旧标签")
      expect(previous.presentationState.peek()).toMatchObject({
        visible: false,
        disabled: false,
      })
      expect(node.presentationState.peek().disabled).toBe(true)

      node.dependencyOverrides.value = { visible: true }
      expect(previous.dependencyOverrides.peek()).toEqual({ visible: false })
      expect(previous.presentationState.peek().visible).toBe(false)
      expect(node.presentationState.peek().visible).toBe(true)

      if (isDynamicNode(node) && isDynamicNode(previous)) {
        expect(previous.dynamicRows).not.toBe(node.dynamicRows)
        expect(previous.dynamicRows.peek()).toHaveLength(1)
        context.store.setFieldValue("users", [])
        expect(node.dynamicRows.peek()).toEqual([])
        expect(previous.dynamicRows.peek()).toHaveLength(1)
      }
    } finally {
      reconciler.clear()
    }
  })

  it("单独卸载只释放资源，字段值由协调器在整批提交结束后清理", () => {
    // unmounted 回调仍能读取尚未经过最终路径占用检查的字段值。
    const hooks = { unmounted: vi.fn() }

    const { commitSchemas, root, context, reconciler } = createRuntimeGraphHarness(hooks)

    context.store.setFieldValue("name", "edited")
    commitSchemas(root, [
      {
        key: "name",
        name: "name",
        label: "姓名",
        componentType: "text",
        preserve: false,
      },
    ])

    // 直接验证资源卸载边界，不经协调器的通知和延迟删值路径。
    const node = root.childNodes.peek()[0]

    if (!isFieldNode(node)) {
      throw new Error("字段节点未挂载")
    }

    try {
      context.nodeManager.remove(node.id)
      unmountNodeResources(node, context)
      expect(node.validationEffectScope).toBeNull()
      expect(node.viewSchemas).toBeNull()
      expect(context.store.getFieldValue("name")).toBe("edited")
      expect(hooks.unmounted).not.toHaveBeenCalled()
    } finally {
      disposeNodeResources(node)
      reconciler.clear()
    }
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

    expect(field.compiledSchema).toBeDefined()
    expect(field.viewSchemas).not.toBeNull()
    expect(field.validationEffectScope).toBeDefined()
    expect(findFieldNode(root, "name" as any)).toBe(field)

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.compiledSchema).toBeDefined()
    expect(field.viewSchemas).toBeNull()
    expect(field.validationEffectScope).toBeNull()
    expect(findFieldNode(root, "name" as any)).toBeUndefined()
  })

  it("字段改名保留节点身份，重建路径校验作用域并注销旧配置", () => {
    const { commitSchemas, context, root } = createRuntimeGraphHarness()

    vi.spyOn(context.validator, "removeField")

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    const previousValidationEffectScope = field.validationEffectScope

    expect(previousValidationEffectScope).not.toBeNull()
    expect(previousValidationEffectScope?.disposed).toBe(false)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

    expect(previousValidationEffectScope?.disposed).toBe(true)
    expect(findFieldNode(root, "nickname")).toBe(field)
    expect(field.validationEffectScope).not.toBeNull()
    expect(field.validationEffectScope).not.toBe(previousValidationEffectScope)
    expect(field.validationEffectScope?.disposed).toBe(false)
    expect(context.validator.removeField).toHaveBeenCalledWith("name")
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
      compiledSchema: schema,
      debug: true,
    })

    resetFieldDependencyOverrides(state, "dispose")

    expect(readDiagnostics(state).lastUpdatedBy).toBe("dispose")
    expect(state.dependencyOverrides.value).toEqual({})
  })

  it("dispose 后不应再接受动态覆盖写入（调用方负责检查 scope）", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
      debug: true,
    })

    resetFieldDependencyOverrides(state, "dispose")

    // 即使尝试写入，diagnostics 仍标记为 dispose
    setFieldDependencyOverrides(
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

  it("reset 后 dependencyOverrides 应清空", () => {
    const schema = createTestSchema({ visible: true })

    const state = createFieldRuntimeSignals({
      nodeId: 1,
      key: "field-1",
      name: "email" as any,
      compiledSchema: schema,
    })

    setFieldDependencyOverrides(
      state,
      { visible: false, disabled: true },
      {
        source: "dependencies",
        triggerFields: ["country" as any],
      }
    )

    resetFieldDependencyOverrides(state, "reset")

    expect(state.dependencyOverrides.value).toEqual({})
    expect(state.resolvedSchema.value.visible).toBe(true)
    expect(state.resolvedSchema.value.disabled).toBe(false)
  })
})
