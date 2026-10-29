/**
 * NodeManager 的单元测试。
 *
 * 覆盖节点注册、移动、删除和 root 索引生命周期。
 *
 * @module core/node/__tests__/nodeManager.test
 */

import { describe, expect, it } from "vite-plus/test"

import { createNodeManager, createScope, isDynamicNode } from ".."
import { createSchemaCompiler } from "../../compiler"
import { createFormConfig } from "../../config/createFormConfig"
import { batchUpdates, createSignalEffect } from "../../reactivity"

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
    expect(manager.getPaths()).toEqual([])
    expect(manager.getNodeId("field")).toBeUndefined()
    expect(() => manager.updatePaths([])).toThrow("disposed")
    expect(() => manager.setArrayRows(1, [])).toThrow("disposed")
    expect(() =>
      manager.insert(
        createFieldNode({ id: 2, ...createFieldNodeOptions("next") }),
        root.id
      )
    ).toThrow("NodeManager has already been disposed")
  })

  it("子树登记按规范化路径去重，查询快照和同路径身份不受树重排影响", () => {
    const manager = createNodeManager()

    const group = createGroupNode({ id: 1, ...createGroupNodeOptions("group") })

    const first = createPathField(2, "users.0.name")

    const second = createPathField(3, "users[0].name")

    group.childNodes.value = [first, second]
    manager.insert(group, 0)

    const paths = manager.getPaths()

    const ids = manager.getNodeIds("users.0.name")

    expect(paths).toEqual(["users.0.name"])
    expect(ids).toEqual([2, 3])
    expect(manager.getNodeId("users[0].name")).toBe(2)
    expect(manager.getNodeId("missing")).toBeUndefined()
    expect(manager.getPath(group.id)).toBeUndefined()
    expect(manager.getPath(0)).toBeUndefined()
    manager.reorderChildren(group.id, [second, first])
    expect(manager.getNodeIds("users.0.name")).toEqual([2, 3])
    manager.updatePaths([{ nodeId: first.id, path: "email" }])
    expect(paths).toEqual(["users.0.name"])
    expect(ids).toEqual([2, 3])
    expect(manager.getNodeId("users.0.name")).toBe(3)
    manager.remove(group.id)
    expect(manager.getPaths()).toEqual([])
    expect(manager.getPath(first.id)).toBeUndefined()
    expect(manager.getNodeIds("users.0.name")).toEqual([])
  })

  it("区分包含点号的单个属性和嵌套路径，相同写法更新不重新登记", () => {
    const manager = createNodeManager()

    const literal = createPathField(1, '["user.name"]')

    const nested = createPathField(2, "user.name")

    const replacement = createPathField(3, "user.name")

    manager.insert(literal, 0)
    manager.insert(nested, 0)
    manager.insert(replacement, 0)
    manager.updatePaths([{ nodeId: nested.id, path: "user.name" }])
    expect(manager.getNodeIds('["user.name"]')).toEqual([1])
    expect(manager.getNodeIds("user.name")).toEqual([2, 3])
    expect(manager.getPaths()).toEqual(['["user.name"]', "user.name"])
    manager.remove(nested.id)
    expect(manager.getNodeId("user.name")).toBe(replacement.id)
  })

  it("批量交换路径时消费者只观察到同步的节点路径和索引", () => {
    const manager = createNodeManager()

    const first = createPathField(1, "first")

    const second = createPathField(2, "second")

    manager.insert(first, 0)
    manager.insert(second, 0)
    const seen: unknown[] = []

    const stop = createSignalEffect(() => {
      const firstPath = manager.getPath(first.id)

      const secondPath = manager.getPath(second.id)

      seen.push([
        firstPath,
        secondPath,
        manager.getNodeId("first"),
        manager.getNodeId("second"),
      ])
    })

    manager.updatePaths([
      { nodeId: 1, path: "second" },
      { nodeId: 2, path: "first" },
    ])
    expect(seen).toEqual([
      ["first", "second", 1, 2],
      ["second", "first", 2, 1],
    ])
    expect(first.compiledSchema.peek().name).toBe("first")
    manager.move(first.id, 0, 1)
    expect(manager.getPath(first.id)).toBe("second")
    stop()
  })

  it("批量输入包含未知、无路径或重复身份时不写入任何路径", () => {
    const manager = createNodeManager()

    const field = createPathField(1, "name")

    const group = createGroupNode({ id: 2, ...createGroupNodeOptions("group") })

    manager.insert(field, 0)
    manager.insert(group, 0)
    for (const invalidId of [999, group.id, 0, field.id]) {
      expect(() =>
        manager.updatePaths([
          { nodeId: field.id, path: "next" },
          { nodeId: invalidId, path: "invalid" },
        ])
      ).toThrow("path node")
      expect(manager.getPath(field.id)).toBe("name")
      expect(field.compiledSchema.peek().name).toBe("name")
      expect(manager.getNodeIds("next")).toEqual([])
    }

    manager.remove(field.id)
    expect(() => manager.updatePaths([{ nodeId: field.id, path: "next" }])).toThrow(
      "path node"
    )
  })

  it("数组根、行和普通字段共享路径索引，行不参与树节点数量和查询", () => {
    const manager = createNodeManager()

    const array = createArrayNode()

    const field = createPathField(2, "users.0")

    manager.insert(array, 0)
    manager.setArrayRows(array.id, [
      { id: 10, key: "first", index: 0, path: "users.0" },
      { id: 11, key: "second", index: 1, path: "users.1" },
    ])
    manager.insert(field, 0)
    expect(manager.size).toBe(3)
    expect(manager.has(10)).toBe(false)
    expect(manager.get(10)).toBeUndefined()
    expect(manager.values().map((node) => node.id)).toEqual([0, array.id, field.id])
    expect(manager.getPaths()).toEqual(["users", "users.0", "users.1"])
    expect(manager.getNodeIds("users.0")).toEqual([10, field.id])

    const seen: unknown[] = []

    const stop = createSignalEffect(() =>
      seen.push([manager.getPath(10), manager.getPath(11)])
    )

    manager.updatePaths([
      { nodeId: 10, path: "users.1" },
      { nodeId: 11, path: "users.0" },
    ])
    expect(seen).toEqual([
      ["users.0", "users.1"],
      ["users.1", "users.0"],
    ])
    manager.setArrayRows(array.id, [{ id: 11, key: "second", index: 0, path: "users.0" }])
    expect(manager.getPath(10)).toBeUndefined()
    expect(manager.getNodeIds("users.0")).toEqual([field.id, 11])
    expect(() => manager.updatePaths([{ nodeId: 10, path: "users.0" }])).toThrow(
      "path node"
    )
    // 数组编译配置由调用方发布，NodeManager 只同步对应的路径索引。
    batchUpdates(() => {
      array.compiledSchema.value = { ...array.compiledSchema.peek(), name: "members" }
      manager.updatePaths([{ nodeId: array.id, path: "members" }])
    })
    expect(manager.getPath(array.id)).toBe("members")
    expect(manager.getNodeId("users")).toBeUndefined()
    manager.remove(array.id)
    expect(manager.getPath(11)).toBeUndefined()
    expect(manager.getNodeIds("users.0")).toEqual([field.id])
    expect(manager.getNodeId("members")).toBeUndefined()
    stop()
    manager.clear()
    expect(manager.getPaths()).toEqual([])
  })

  it("数组行列表校验失败不改变原有行和索引", () => {
    const manager = createNodeManager()

    const array = createArrayNode()

    const field = createPathField(2, "name")

    manager.insert(array, 0)
    manager.insert(field, 0)
    const rows = [{ id: 10, key: "first", index: 0, path: "users.0" }]

    manager.setArrayRows(array.id, rows)
    for (const invalidRows of [[...rows, rows[0]], [{ ...rows[0], id: field.id }]]) {
      expect(() => manager.setArrayRows(array.id, invalidRows)).toThrow("row id")
      expect(array.dynamicRows.peek()).toBe(rows)
      expect(manager.getNodeIds("users.0")).toEqual([10])
    }

    expect(() => manager.setArrayRows(field.id, [])).toThrow("Dynamic")
    expect(() => manager.setArrayRows(999, [])).toThrow("does not exist")
  })

  it("带行状态的整棵子树在登记前统一校验共享 ID 空间", () => {
    const manager = createNodeManager()

    const array = createArrayNode()

    const field = createPathField(2, "name")

    array.dynamicRows.value = [{ id: field.id, key: "row", index: 0, path: "users.0" }]
    array.childNodes.value = [field]
    expect(() => manager.insert(array, 0)).toThrow("row id")
    expect(manager.size).toBe(1)
    expect(manager.getPaths()).toEqual([])
    expect(manager.getChildren(0)).toEqual([])
    array.dynamicRows.value = [{ id: 10, key: "row", index: 0, path: "users.0" }]
    manager.insert(array, 0)
    expect(manager.getNodeId("users.0")).toBe(10)
    expect(manager.size).toBe(3)
    manager.clear()
    expect(manager.getNodeId("users.0")).toBeUndefined()
  })
})

/**
 * 创建具有指定身份和路径的字段，供索引测试复用。
 * @param id - 测试使用的节点身份。
 * @param name - 当前业务路径。
 */
function createPathField(id: number, name: string) {
  return createFieldNode({ id, ...createFieldNodeOptions(name) })
}

/**
 * 使用真实 Compiler 创建数组根，避免手写 Dynamic 的运行态。
 */
function createArrayNode() {
  // 先编译纯配置，再创建本测试所需的独立数组节点。
  const compiler = createSchemaCompiler({
    config: createFormConfig().getConfig(),
  })

  const node = compiler.createNode(
    compiler.compile({ key: "users", name: "users", item: [] }, "root", 0),
    createScope()
  )

  if (!isDynamicNode(node)) {
    throw new Error("Expected Dynamic node")
  }

  return node
}

function createFieldNodeOptions(key: string) {
  return {
    key,
    configToken: Symbol(key),
    name: key,
    compiledSchema: { name: key, componentType: "input" } as never,
  }
}

function createGroupNodeOptions(key: string) {
  return {
    key,
    configToken: Symbol(key),
    compiledSchema: {
      label: key,
      children: [],
      visible: true,
      readonly: false,
      disabled: false,
    } as never,
  }
}
