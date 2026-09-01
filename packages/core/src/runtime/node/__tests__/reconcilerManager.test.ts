/**
 * Reconciler 与 NodeManager 集成测试。
 *
 * 覆盖 schema 提交后的节点创建、复用、替换、索引与资源清理。
 *
 * @module core/runtime/node/__tests__/reconcilerManager.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { FieldRuntimeNode } from "../types"

// 验证 reconciler 通过 NodeManager 维护运行时树。
describe("RuntimeReconciler + NodeManager", () => {
  it("创建 root 时不持有额外字段索引", () => {
    const { root } = createRuntimeGraphHarness()

    expect(root.childNodes.value).toEqual([])
  })

  it("递归提交嵌套 group 子树", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        label: "根分组",
        children: [
          {
            label: "嵌套分组",
            children: [createRawFieldSchema("field", "field")],
          },
        ],
      },
    ])

    expect(root.childNodes.value).toHaveLength(1)
    expect(
      root.childNodes.value[0]?.type === "group" &&
        root.childNodes.value[0].childNodes.value[0]?.type === "group"
        ? root.childNodes.value[0].childNodes.value[0].childNodes.value[0]?.key
        : undefined
    ).toBe("field")
  })

  it("生命周期事件在创建、更新和移除时各触发一次", () => {
    const hooks = {
      created: vi.fn(),
      mounted: vi.fn(),
      updated: vi.fn(),
      unmounted: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), label: "更新后的标签" },
    ])
    commitSchemas(root, [])

    expect(hooks.mounted).toHaveBeenCalledTimes(1)
    expect(hooks.updated).toHaveBeenCalledTimes(1)
    expect(hooks.unmounted).toHaveBeenCalledTimes(1)
    expect(hooks.created).toHaveBeenCalledTimes(2)
  })

  it("reconcileChildren 拒绝不存在或非容器 parent", () => {
    const { commitSchemas, context, root } = createRuntimeGraphHarness()

    expect(() => context.reconcileChildren(999, [])).toThrow(
      'RuntimeNode "999" does not exist'
    )

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0]

    if (!field) {
      throw new Error("expected field")
    }

    expect(() => context.reconcileChildren(field.id, [])).toThrow(
      `RuntimeNode "${field.id}" cannot contain children`
    )
  })

  it("同名字段改 key 时移除旧节点并建立新节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("old", "user.name")])
    const oldNode = root.childNodes.value[0]

    commitSchemas(root, [createRawFieldSchema("new", "user.name")])
    const newNode = root.childNodes.value[0]

    expect(oldNode?.disposed.value).toBe(true)
    expect(newNode?.key).toBe("new")
    expect(newNode?.type === "field" && newNode.name.value).toBe("user.name")
  })

  it("提交空 Schema 时清理资源并断开父子关系", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldRuntimeNode

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.staticSchema.value.name).toBe("name")
    expect(field.parent).toBeNull()
  })

  it("dependency trigger 更新时复用节点并写入最新配置", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createDependencySchema(["type"])])
    const dependency = root.childNodes.value[0]

    commitSchemas(root, [createDependencySchema(["mode"])])

    expect(root.childNodes.value[0]).toBe(dependency)
    expect(
      dependency?.type === "dependency" && dependency.staticSchema.value.to
    ).toEqual(["mode"])
  })
})

function createDependencySchema(triggerFields: string[]) {
  return {
    key: "dep",
    to: triggerFields,
    renderer: () => [],
  }
}
