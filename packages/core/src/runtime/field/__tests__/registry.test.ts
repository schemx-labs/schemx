/**
 * FieldRegistry 模块测试。
 *
 * @module core/runtime/field/__tests__/fieldRegistry.test
 */

import { describe, expect, it } from "vitest"

import {
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "../../node/__tests__/runtimeNodeTestUtils"
import { createFieldRuntimeState } from "../runtimeState"
import { createFieldRegistry } from "../registry"

import type { FieldDescriptor } from "../../descriptor/types"

const createDescriptor = (name: string): FieldDescriptor => ({
  type: "field",
  key: `field-${name}`,
  name,
  componentType: "input",
  staticSchema: {
    name,
    componentType: "input",
  },
})

const createEntry = (name: string) => {
  const descriptor = createDescriptor(name)
  const root = createTestRootRuntimeNode()
  const node = createTestFieldRuntimeNode({
    key: descriptor.key,
    parent: root,
    descriptor,
  })
  const runtimeState = createFieldRuntimeState({
    nodeId: node.id,
    key: node.key,
    descriptor: { name: descriptor.name, staticSchema: descriptor.staticSchema },
  })

  return { name, node, descriptor, runtimeState }
}

// createFieldRegistry 的基本注册、查询和 find 行为
describe("createFieldRegistry", () => {
  it("应该创建空 Registry", () => {
    const registry = createFieldRegistry()

    expect(registry.list()).toEqual([])
  })

  it("应该按 descriptor.name 注册字段 entry", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("field1")

    registry.register(entry)

    expect(registry.get("field1" as any)?.node).toBe(entry.node)
  })

  it("Registry entry 只保存字段索引和 RuntimeNode", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("field1")

    registry.register(entry)

    expect(registry.get("field1" as any)).toEqual({
      name: "field1",
      node: entry.node,
    })
    expect("runtimeState" in registry.get("field1" as any)!).toBe(false)
  })

  it("应该支持嵌套与字符串 name path 查询", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("user.name")

    registry.register(entry)

    expect(registry.get("user.name" as any)?.node).toBe(entry.node)
    expect(registry.getByName("user.name" as any)?.node).toBe(entry.node)
    expect(registry.getByPath("user.name" as any)?.node).toBe(entry.node)
    expect(registry.get("not-exist" as any)).toBeUndefined()
    expect(registry.getByName("not-exist" as any)).toBeUndefined()
    expect(registry.getByPath("not-exist" as any)).toBeUndefined()
  })
})

// 字段列表查询和按 name 注销的行为
describe("list and unregister", () => {
  it("应该列出所有字段 entry", () => {
    const registry = createFieldRegistry()
    const entry1 = createEntry("field1")
    const entry2 = createEntry("field2")

    registry.register(entry1)
    registry.register(entry2)

    expect(registry.list()).toEqual([
      { name: "field1", node: entry1.node },
      { name: "field2", node: entry2.node },
    ])
  })

  it("应该按 name 注销字段 entry", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("field1")

    registry.register(entry)
    registry.unregister("field1" as any)

    expect(registry.get("field1" as any)).toBeUndefined()
    expect(registry.list()).toEqual([])
  })

  it("旧 node 注销时不会移除同名新 node 的注册项", () => {
    const registry = createFieldRegistry()
    const oldEntry = createEntry("user.name")
    const root = createTestRootRuntimeNode()
    const descriptor = createDescriptor("user.name")
    const newEntry = {
      ...createEntry("user.name"),
      node: createTestFieldRuntimeNode({
        id: 2,
        key: "new-field",
        parent: root,
        descriptor,
      }),
    }

    registry.register(oldEntry)
    registry.register(newEntry)
    registry.unregister("user.name" as any, oldEntry.node)

    expect(registry.get("user.name" as any)).toEqual({
      name: "user.name",
      node: newEntry.node,
    })
  })
})
