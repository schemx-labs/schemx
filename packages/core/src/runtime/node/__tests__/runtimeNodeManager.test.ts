/**
 * RuntimeNodeManager 的单元测试。
 *
 * 覆盖 runtimeRegistry、节点创建/注册、insertChild / replaceChildren /
 * removeSubtree 等结构操作的正确性。
 *
 * @module core/runtime/node/__tests__/runtimeNodeManager.test
 */

import { describe, expect, it } from "vitest"

import { mergeAndResolveSchemxConfig } from "../../../config"
import { createCompile } from "../../compiler"
import { createLifecycleBus } from "../../lifecycle"
import { createScheduler } from "../../scheduler"
import { createRuntimeNodeManager } from "../runtimeNodeManager"
import { createRuntimeRegistry } from "../runtimeRegistry"

import type { Values } from "../../../types"
import type { SchemaRuntimeContext } from "../../context"
import type { RuntimeNodeInput } from "../input"
import type { RuntimeNodeManager } from "../types"

function createRuntimeContext<
  TValues extends Values = Values,
>(): SchemaRuntimeContext<TValues> {
  const runtimeRegistry = createRuntimeRegistry<TValues>()

  const scheduler = createScheduler()

  const instance = {
    getFieldSnapshot: () => undefined,
    setInitialValues: () => undefined,
    setFieldValue: () => undefined,
    validateField: async () => ({ valid: true, values: {}, errors: [] }),
  }

  const formApi = {
    getValues: () => ({}),
  }

  return {
    schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    instance,
    model: {
      registerFieldPath: () => undefined,
      getFieldValue: () => undefined,
      setFieldValue: () => undefined,
      setInitialValues: () => undefined,
      syncValidationField: () => false,
      removeValidationField: () => undefined,
      removeSchemaValidationField: () => undefined,
    },
    formApi,
    compile: createCompile({
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
      formInstance: instance as any,
    }),
    scheduler,
    validation: {
      syncField: () => undefined,
      removeField: () => undefined,
      removeSchemaField: () => undefined,
    },
    lifecycleBus: createLifecycleBus(),
    runtimeRegistry,
    reconcileChildren: () => undefined,
  } as unknown as SchemaRuntimeContext<TValues>
}

function createTreeManager(): RuntimeNodeManager {
  return createRuntimeNodeManager(createRuntimeContext())
}

// RuntimeNodeManager 的 API：资源结构、节点创建、结构操作（insertChild/replaceChildren/removeSubtree）
describe("RuntimeNodeManager", () => {
  it("runtimeRegistry 只保留字段索引", () => {
    const registry = createRuntimeRegistry()

    expect(Object.keys(registry)).toEqual(["fieldIndex"])
  })

  it("应该通过显式 context 使用同一份 runtimeRegistry", () => {
    const context = createRuntimeContext()

    const manager = createRuntimeNodeManager(context)

    expect(manager.createRoot().dispose.disposed).toBe(false)
  })

  it("应该只暴露 runtime tree 结构操作", () => {
    const manager = createTreeManager()

    expect(manager).toEqual(
      expect.objectContaining({
        createRoot: expect.any(Function),
        createNode: expect.any(Function),
        traverse: expect.any(Function),
        insertChild: expect.any(Function),
        replaceChildren: expect.any(Function),
        removeChild: expect.any(Function),
        removeSubtree: expect.any(Function),
      })
    )

    expect("mount" in manager).toBe(false)
    expect("update" in manager).toBe(false)
    expect("updateDescriptor" in manager).toBe(false)
    expect("unmount" in manager).toBe(false)
    expect("disposeTree" in manager).toBe(false)
  })

  it("创建 node 时维护 parent 初始状态", () => {
    const context = createRuntimeContext()

    const manager = createRuntimeNodeManager(context)

    const root = manager.createRoot()

    const field = manager.createNode({ input: createFieldInput("field:name", "name") })

    expect(field.parent).toBeNull()
    expect(root.childNodes.value).toEqual([])
  })

  it("insertChild 应该维护 parent 和 children 数组一致性", () => {
    const manager = createTreeManager()

    const root = manager.createRoot()

    const first = manager.createNode({ input: createFieldInput("first", "first") })

    const second = manager.createNode({ input: createFieldInput("second", "second") })

    manager.insertChild(root, second)
    manager.insertChild(root, first, 0)

    expect(root.childNodes.value).toEqual([first, second])
    expect(first.parent).toBe(root)
    expect(second.parent).toBe(root)
  })

  it("replaceChildren 应该替换 children 并清空被移除节点 parent", () => {
    const manager = createTreeManager()

    const root = manager.createRoot()

    const first = manager.createNode({ input: createFieldInput("first", "first") })

    const second = manager.createNode({ input: createFieldInput("second", "second") })

    const third = manager.createNode({ input: createFieldInput("third", "third") })

    manager.replaceChildren(root, [first, second])
    const previous = root.childNodes.value

    manager.replaceChildren(root, [third])

    expect(root.childNodes.value).toEqual([third])
    expect(root.childNodes.value).not.toBe(previous)
    expect(first.parent).toBeNull()
    expect(second.parent).toBeNull()
    expect(third.parent).toBe(root)
  })

  it("removeSubtree 应该深度删除节点、释放结构 scope 并维护父子关系", () => {
    const context = createRuntimeContext()

    const manager = createRuntimeNodeManager(context)

    const root = manager.createRoot()

    const group = manager.createNode({ input: createGroupInput("group") })

    const field = manager.createNode({ input: createFieldInput("field", "field") })

    if (group.type !== "group") {
      throw new Error("expected group node")
    }

    manager.replaceChildren(root, [group])
    manager.replaceChildren(group, [field])
    manager.removeSubtree(group)

    expect(root.childNodes.value).toEqual([])
    expect(group.parent).toBeNull()
    expect(field.parent).toBeNull()
    expect(group.dispose.disposed).toBe(true)
    expect(field.dispose.disposed).toBe(true)
  })
})

function createFieldInput(key: string, name: string): RuntimeNodeInput {
  return {
    type: "field",
    key,
    configToken: Symbol(key),
    name,
    componentType: "input",
    staticSchema: { name, componentType: "input" } as never,
    dynamicProps: null,
    validation: null,
  }
}

function createGroupInput(key: string): RuntimeNodeInput {
  return {
    type: "group",
    key,
    configToken: Symbol(key),
    staticSchema: { label: "group", children: [] } as never,
    staticState: { visible: true, readonly: false, disabled: false },
    dynamicProps: null,
  }
}
