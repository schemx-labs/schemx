/**
 * NodeManager 的单元测试。
 *
 * 覆盖节点注册、移动、删除和 root 索引生命周期。
 *
 * @module core/runtime/node/__tests__/nodeManager.test
 */

import { describe, expect, it } from "vitest"

import { createNodeManager } from "../nodeManager"

import { createFieldNode, createGroupNode } from "./nodeTestUtils"

describe("NodeManager", () => {
  it("创建 root 并注册到节点索引", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    expect(manager.get(root.id)).toBe(root)
    expect(manager.size).toBe(1)
    expect(root.scope.disposed).toBe(false)
  })

  it("插入和移动节点时维护索引、parent 与 children", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const first = createFieldNode({ id: 1, ...createFieldNodeOptions("first") })

    const second = createFieldNode({ id: 2, ...createFieldNodeOptions("second") })

    manager.insert(first, root.id)
    manager.insert(second, root.id, 0)

    expect(root.childNodes.value).toEqual([second, first])
    expect(first.parent).toBe(root)
    expect(manager.get(1)).toBe(first)

    manager.move(first.id, root.id, 0)

    expect(root.childNodes.value).toEqual([first, second])
    expect(manager.getIndex(first.id)).toBe(0)
  })

  it("批量重排既有子节点时只更新顺序并保留节点归属", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const first = createFieldNode({ id: 1, ...createFieldNodeOptions("first") })

    const second = createFieldNode({ id: 2, ...createFieldNodeOptions("second") })

    manager.insert(first, root.id)
    manager.insert(second, root.id)
    manager.reorderChildren(root.id, [second, first])

    expect(root.childNodes.value).toEqual([second, first])
    expect(first.parent).toBe(root)
    expect(second.parent).toBe(root)
    expect(manager.values()).toEqual([root, first, second])
  })

  it("删除子树时仅解除结构并返回 preorder 节点", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const group = createGroupNode({ id: 1, ...createGroupNodeOptions("group") })

    const field = createFieldNode({ id: 2, ...createFieldNodeOptions("field") })

    manager.insert(group, root.id)
    manager.insert(field, group.id)
    const removed = manager.remove(group.id)

    expect(root.childNodes.value).toEqual([])
    expect(group.parent).toBeNull()
    expect(field.parent).toBeNull()
    expect(manager.has(group.id)).toBe(false)
    expect(manager.has(field.id)).toBe(false)
    expect(removed).toEqual([group, field])
    expect(group.disposed.value).toBe(false)
    expect(field.scope.disposed).toBe(false)
  })

  it("values 只返回仍在节点索引中的活跃节点", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const field = createFieldNode({ id: 1, ...createFieldNodeOptions("field") })

    manager.insert(field, root.id)
    expect(manager.values()).toEqual([root, field])

    manager.remove(field.id)
    expect(manager.values()).toEqual([root])
  })

  it("dispose 关闭索引并拒绝后续写操作", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const field = createFieldNode({ id: 1, ...createFieldNodeOptions("field") })

    manager.insert(field, root.id)
    manager.clear()
    manager.dispose()

    expect(root.disposed.value).toBe(false)
    expect(root.scope.disposed).toBe(false)
    expect(manager.size).toBe(0)
    expect(() =>
      manager.insert(
        createFieldNode({ id: 2, ...createFieldNodeOptions("next") }),
        root.id
      )
    ).toThrow("NodeManager has already been disposed")
  })
})

function createFieldNodeOptions(key: string) {
  return {
    key,
    configToken: Symbol(key),
    name: key,
    staticSchema: { name: key, componentType: "input" } as never,
  }
}

function createGroupNodeOptions(key: string) {
  return {
    key,
    configToken: Symbol(key),
    staticSchema: {
      label: key,
      children: [],
      visible: true,
      readonly: false,
      disabled: false,
    } as never,
  }
}
