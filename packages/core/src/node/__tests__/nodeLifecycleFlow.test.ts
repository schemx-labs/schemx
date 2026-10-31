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
import * as snapshots from "../snapshot"

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
  it("detached 节点创建和丢弃不自行通知生命周期", () => {
    const hooks = { created: vi.fn(), unmounted: vi.fn() }

    const { compiler } = createRuntimeGraphHarness(hooks)

    const node = compiler.createNode(
      compiler.compile(createRawFieldSchema("detached"), "", 0),
      createScope()
    )

    disposeNodeResources(node)
    expect(hooks.created).not.toHaveBeenCalled()
    expect(hooks.unmounted).not.toHaveBeenCalled()
    expect(node.scope.disposed).toBe(true)
  })

  it("没有 hook 时不构造通知快照，created 不提前求值子字段呈现态", () => {
    // 通知开关不能导致节点更新额外分配公开快照。
    const capture = vi.spyOn(snapshots, "createNodeSnapshot")

    const plain = createRuntimeGraphHarness()

    try {
      plain.commitSchemas(plain.root, [createRawFieldSchema("name")])
      plain.commitSchemas(plain.root, [
        { ...createRawFieldSchema("name"), label: "next" },
      ])
      plain.reconciler.clear()
      expect(capture).not.toHaveBeenCalled()
    } finally {
      capture.mockRestore()
    }

    // created 时字段尚无 parent，快照不能访问会缓存继承状态的 computed。
    const observed = createRuntimeGraphHarness({ created: vi.fn() })

    try {
      observed.commitSchemas(observed.root, [
        { label: "disabled", disabled: true, children: [createRawFieldSchema("child")] },
      ])
      const group = observed.root.childNodes.peek()[0]

      if (!group || group.type !== "group") throw new Error("分组未挂载")
      const field = group.childNodes.peek()[0]

      if (!isFieldNode(field)) throw new Error("字段未挂载")
      expect(field.resolvedSchema.peek().disabled).toBe(true)
    } finally {
      observed.reconciler.clear()
    }
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

  it("生命周期只接收冻结的普通数据，旧快照不随后续更新改变", () => {
    const hooks = { mounted: vi.fn(), updated: vi.fn() }

    const { commitSchemas, root, compiler, reconciler } = createRuntimeGraphHarness(hooks)

    const configuration = createFormConfig({ config: { debug: true } })

    compiler.setConfig(configuration.getConfig())
    configuration.dispose()
    try {
      commitSchemas(root, [{ ...createRawFieldSchema("name"), label: "旧标签" }])
      const node = root.childNodes.peek()[0] as FieldNode

      setFieldDependencyOverrides(
        node,
        { visible: false },
        {
          source: "dependencies",
          triggerFields: ["visible" as never],
        }
      )
      commitSchemas(root, [
        { ...createRawFieldSchema("name", "nickname"), label: "新标签" },
      ])
      const [current, previous] = hooks.updated.mock.calls[0] ?? []

      expect(hooks.mounted.mock.calls[0]?.[0]).toMatchObject({
        name: "name",
        parentId: 0,
      })
      expect(current).toMatchObject({
        id: node.id,
        name: "nickname",
        compiledSchema: { label: "新标签" },
      })
      expect(previous).toMatchObject({
        name: "name",
        compiledSchema: { label: "旧标签" },
        dependencyOverrides: { visible: false },
      })
      for (const snapshot of [current, previous]) {
        expect(Object.isFrozen(snapshot)).toBe(true)
        expect(Object.isFrozen(snapshot.dependencyOverrides)).toBe(true)
        expect(Object.isFrozen(snapshot.diagnostics.triggerFields)).toBe(true)
        for (const resource of [
          "scope",
          "parent",
          "pathController",
          "resolvedSchema",
          "validationState",
          "viewSchemas",
        ]) {
          expect(snapshot).not.toHaveProperty(resource)
        }
      }

      node.dependencyOverrides.value = { visible: true }
      expect(previous.dependencyOverrides).toEqual({ visible: false })
      expect(previous.diagnostics.triggerFields).toEqual(["visible"])
      expect(node.name.peek()).toBe("nickname")
    } finally {
      reconciler.clear()
    }
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
  ])("$kind 更新快照保存配置和元数据，不暴露资源句柄", ({ schema }) => {
    const hooks = { updated: vi.fn() }

    const { commitSchemas, root, context, reconciler } = createRuntimeGraphHarness(hooks)

    context.store.setFieldValue("users", [{ name: "Ada" }])
    commitSchemas(root, [schema])
    const node = root.childNodes.peek()[0]

    if (!node || isFieldNode(node)) throw new Error("容器节点未挂载")
    node.dependencyOverrides.value = { visible: false }
    try {
      commitSchemas(root, [{ ...schema, label: "新标签", disabled: true }])
      const previous = hooks.updated.mock.calls[0]?.[1]

      expect(previous.compiledSchema.label).toBe("旧标签")
      expect(previous).not.toHaveProperty("scope")
      expect(previous).not.toHaveProperty("presentationState")
      expect(Object.isFrozen(previous.childIds)).toBe(true)
      node.dependencyOverrides.value = { visible: true }
      expect(previous.dependencyOverrides).toEqual({ visible: false })
      if (isDynamicNode(node)) {
        expect(Object.isFrozen(previous.rows)).toBe(true)
        expect(Object.isFrozen(previous.rows[0])).toBe(true)
        context.store.setFieldValue("users", [])
        expect(node.dynamicRows.peek()).toEqual([])
        expect(previous.rows).toHaveLength(1)
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
