/**
 * Reconciler 的运行时节点协调测试。
 *
 * 覆盖原始 schema 提交后的创建、复用、更新、替换、删除与嵌套协调行为。
 *
 * @module core/runtime/reconciler/__tests__/reconciler.test
 */

import { describe, expect, it } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
} from "../../node/__tests__/runtimeGraphTestUtils"

// 验证 RuntimeNodeInput 驱动的 reconciler 可观察行为。
describe("createReconciler", () => {
  it("创建、复用并按最新 schema 排列子节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()
    const firstSchema = createRawFieldSchema("name", "name")
    const secondSchema = createRawFieldSchema("email", "email")

    commitSchemas(root, [firstSchema, secondSchema])

    const nameNode = root.childNodes.value[0]
    const emailNode = root.childNodes.value[1]

    commitSchemas(root, [secondSchema, firstSchema])

    expect(root.childNodes.value).toEqual([emailNode, nameNode])
  })

  it("同 key 同类型节点会更新配置而不重建", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), label: "旧标签" },
    ])

    const field = root.childNodes.value[0]

    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), label: "新标签" },
    ])

    expect(root.childNodes.value[0]).toBe(field)
    expect(field?.type === "field" && field.staticSchema.label).toBe("新标签")
  })

  it("同 key 不同类型会替换节点并释放旧节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("slot", "slot")])
    const previous = root.childNodes.value[0]

    commitSchemas(root, [
      {
        key: "slot",
        label: "分组",
        children: [createRawFieldSchema("child", "child")],
      },
    ])

    const group = root.childNodes.value[0]

    expect(group).not.toBe(previous)
    expect(group?.type).toBe("group")
    expect(group?.type === "group" && group.childNodes.value[0]?.key).toBe("child")
    expect(previous?.disposed.value).toBe(true)
  })

  it("移除 schema 时释放旧节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0]

    commitSchemas(root, [])

    expect(root.childNodes.value).toEqual([])
    expect(field?.disposed.value).toBe(true)
    expect(field?.parent).toBeNull()
  })

  it("拒绝同级重复 runtime key", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    expect(() =>
      commitSchemas(root, [
        createRawFieldSchema("duplicate", "first"),
        createRawFieldSchema("duplicate", "second"),
      ])
    ).toThrow('[schemx] Duplicate runtime node key "duplicate".')
  })

  it("拒绝嵌套的重复字段名，并保留当前子树", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()
    const current = createRawFieldSchema("current", "current")

    commitSchemas(root, [current])

    expect(() =>
      commitSchemas(root, [
        createRawFieldSchema("name", "name"),
        {
          label: "重复字段",
          children: [createRawFieldSchema("nested-name", "name")],
        },
      ])
    ).toThrow('[schemx] Duplicate field name "name" at schemas[0] and schemas[1].children[0].')

    expect(root.childNodes.value[0]?.key).toBe("current")
  })

  it("递归协调 group 子树", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        label: "外层分组",
        children: [
          {
            label: "内层分组",
            children: [createRawFieldSchema("email", "email")],
          },
        ],
      },
    ])

    const outer = root.childNodes.value[0]

    expect(outer?.type).toBe("group")
    expect(
      outer?.type === "group" && outer.childNodes.value[0]?.type === "group"
        ? outer.childNodes.value[0].childNodes.value[0]?.key
        : undefined
    ).toBe("email")
  })
})
