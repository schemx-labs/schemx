/**
 * RuntimeNodeManager 的单元测试。
 *
 * 覆盖 nodeResources 结构、节点创建/注册/查询、insertChild / replaceChildren /
 * removeSubtree 等结构操作的正确性。
 *
 * @module core/runtime/node/__tests__/runtimeNodeManager.test
 */

import { describe, expect, it } from "vitest"

import { createCompile } from "../../compiler"
import { mergeAndResolveSchemxConfig } from "../../../config"
import { createLifecycleBus } from "../../lifecycle"
import { createScheduler } from "../../scheduler"
import { createRuntimeResources } from "../resources"
import { createRuntimeNodeManager } from "../runtimeNodeManager"

import type { SchemaRuntimeContext } from "../../context"
import type { Values } from "../../../types"
import type { RuntimeNodeManager } from "../types"
import type { DependencyDescriptor, FieldDescriptor } from "../../descriptor"

function createRuntimeContext<
  TValues extends Values = Values,
>(): SchemaRuntimeContext<TValues> {
  const nodeResources = createRuntimeResources<TValues>()
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
    formApi,
    compile: createCompile({
      schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
      formInstance: instance as any,
    }),
    scheduler,
    validation: {
      syncField: () => undefined,
      removeField: () => undefined,
    },
    lifecycleBus: createLifecycleBus(),
    nodeResources,
    commitChildren: () => undefined,
  } as unknown as SchemaRuntimeContext<TValues>
}

function createTreeManager(): RuntimeNodeManager {
  return createRuntimeNodeManager(createRuntimeContext())
}

// RuntimeNodeManager 的 API：资源结构、节点创建、结构操作（insertChild/replaceChildren/removeSubtree）
describe("RuntimeNodeManager", () => {
  it("nodeResources 应该只保留结构表和跨节点索引", () => {
    const resources = createRuntimeResources()

    expect(Object.keys(resources).sort()).toEqual([
      "dependencyIndex",
      "fieldIndex",
      "nodes",
    ])
  })

  it("应该通过显式 context 使用同一份 nodeResources", () => {
    const context = createRuntimeContext()
    const manager = createRuntimeNodeManager(context)

    expect(manager.resources).toBe(context.nodeResources)
    expect(manager.nodes).toBe(context.nodeResources.nodes)
  })

  it("nodeResources 应该提供字段和 dependency 索引边界", () => {
    const context = createRuntimeContext()
    const manager = createRuntimeNodeManager(context)
    const root = manager.createRoot()
    const field = manager.createNode({ type: "field", key: "field:name" })
    const dependency = manager.createNode({
      type: "dependency",
      key: "dependency:location",
    })
    const fieldDescriptor: FieldDescriptor = {
      type: "field",
      key: field.key,
      name: "user.name",
      componentType: "input",
      staticSchema: {
        name: "user.name",
        componentType: "input",
      },
    }
    const dependencyDescriptor: DependencyDescriptor = {
      type: "dependency",
      key: dependency.key,
      triggerFields: ["country", "city"],
      renderer: () => [],
    }

    manager.replaceChildren(root, [field, dependency])
    field.descriptor = fieldDescriptor
    dependency.descriptor = dependencyDescriptor

    context.nodeResources.fieldIndex.register(field)
    context.nodeResources.dependencyIndex.register(dependency)

    expect(context.nodeResources.fieldIndex.getByName("user.name" as any)).toBe(field)
    expect(context.nodeResources.fieldIndex.getByPath("user.name" as any)).toBe(field)
    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("country" as any)
    ).toEqual([dependency])
    expect(context.nodeResources.dependencyIndex.getTriggerFields(dependency)).toEqual([
      "country",
      "city",
    ])

    context.nodeResources.fieldIndex.unregister(field)
    context.nodeResources.dependencyIndex.unregister(dependency)

    expect(context.nodeResources.fieldIndex.getByName("user.name" as any)).toBeUndefined()
    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("country" as any)
    ).toEqual([])
  })

  it("应该只暴露 runtime tree 结构操作", () => {
    const manager = createTreeManager()

    expect(manager).toEqual(
      expect.objectContaining({
        resources: expect.any(Object),
        nodes: expect.any(Map),
        createRoot: expect.any(Function),
        create: expect.any(Function),
        createNode: expect.any(Function),
        getNode: expect.any(Function),
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

  it("创建 node 时应该注册到 nodes Map 并维护 parent", () => {
    const manager = createTreeManager()
    const root = manager.createRoot()
    const field = manager.createNode({ type: "field", key: "field:name" })

    expect(manager.getNode(root.id)).toBe(root)
    expect(manager.getNode(field.id)).toBe(field)
    expect(field.parent).toBeNull()
    expect(root.childNodes.value).toEqual([])
  })

  it("insertChild 应该维护 parent 和 children 数组一致性", () => {
    const manager = createTreeManager()
    const root = manager.createRoot()
    const first = manager.createNode({ type: "field", key: "first" })
    const second = manager.createNode({ type: "field", key: "second" })

    manager.insertChild(root, second)
    manager.insertChild(root, first, 0)

    expect(root.childNodes.value).toEqual([first, second])
    expect(first.parent).toBe(root)
    expect(second.parent).toBe(root)
  })

  it("replaceChildren 应该替换 children 并清空被移除节点 parent", () => {
    const manager = createTreeManager()
    const root = manager.createRoot()
    const first = manager.createNode({ type: "field", key: "first" })
    const second = manager.createNode({ type: "field", key: "second" })
    const third = manager.createNode({ type: "field", key: "third" })

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
    const manager = createTreeManager()
    const root = manager.createRoot()
    const group = manager.createNode({ type: "group", key: "group" })
    const field = manager.createNode({ type: "field", key: "field" })

    manager.replaceChildren(root, [group])
    manager.replaceChildren(group, [field])
    manager.removeSubtree(group)

    expect(root.childNodes.value).toEqual([])
    expect(manager.getNode(group.id)).toBeUndefined()
    expect(manager.getNode(field.id)).toBeUndefined()
    expect(group.parent).toBeNull()
    expect(field.parent).toBeNull()
    expect(group.dispose.disposed).toBe(true)
    expect(field.dispose.disposed).toBe(true)
  })
})
