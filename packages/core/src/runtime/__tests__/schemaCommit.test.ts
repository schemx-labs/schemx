/**
 * Schema Schema 提交的运行时节点测试。
 *
 * 覆盖原始 schema 提交后的创建、复用、更新、替换、删除与嵌套协调行为。
 *
 * @module core/runtime/__tests__/schemaCommit.test
 */

import { describe, expect, it } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
} from "../node/__tests__/graphTestUtils"
import { isFieldNode, isGroupNode } from "../node/helper"

// 验证原始 Schema 提交后的 Node 树行为。
describe("commitSchemas", () => {
  it("创建、复用并按最新 schema 排列子节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    const firstSchema = createRawFieldSchema("name", "name")

    const secondSchema = createRawFieldSchema("email", "email")

    commitSchemas(root, [firstSchema, secondSchema])

    const nameNode = root.childNodes.value[0]

    const emailNode = root.childNodes.value[1]

    commitSchemas(root, [secondSchema, firstSchema])

    expect(root.childNodes.value).toEqual([emailNode, nameNode])
    expect(nameNode?.disposed.value).toBe(false)
    expect(emailNode?.disposed.value).toBe(false)
  })

  it("同 key 同类型节点会更新配置而不重建", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [{ ...createRawFieldSchema("name", "name"), label: "旧标签" }])

    const field = root.childNodes.value[0]

    commitSchemas(root, [{ ...createRawFieldSchema("name", "name"), label: "新标签" }])

    expect(root.childNodes.value[0]).toBe(field)
    expect(isFieldNode(field) && field.staticSchema.value.label).toBe("新标签")
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
    expect(isGroupNode(group) && group.childNodes.value[0]?.key).toBe("child")
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

  it("重新提交已移除的同一 schema 时创建新的节点实例", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    const schema = createRawFieldSchema("name", "name")

    commitSchemas(root, [schema])
    const previous = root.childNodes.value[0]

    commitSchemas(root, [])
    commitSchemas(root, [schema])
    const next = root.childNodes.value[0]

    expect(next).not.toBe(previous)
    expect(previous?.disposed.value).toBe(true)
    expect(next?.disposed.value).toBe(false)
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
    ).toThrow(
      '[schemx] Duplicate field name "name" at schemas[0] and schemas[1].children[0].'
    )

    expect(root.childNodes.value[0]?.key).toBe("current")
  })

  it("拒绝目标子树外已存在的字段名", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      createRawFieldSchema("outside", "outside"),
      {
        key: "group",
        label: "分组",
        children: [createRawFieldSchema("current", "current")],
      },
    ])

    const group = root.childNodes.value[1]

    if (!isGroupNode(group)) {
      throw new Error("expected group")
    }

    expect(() =>
      commitSchemas(group, [createRawFieldSchema("duplicate", "outside")])
    ).toThrow(
      '[schemx] Duplicate field name "outside" at schemas[0]; it is already used by runtime node "outside".'
    )
    expect(group.childNodes.value[0]?.key).toBe("current")
  })

  it("允许更新目标子树内同名字段", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "group",
        label: "分组",
        children: [createRawFieldSchema("name", "name")],
      },
    ])

    const group = root.childNodes.value[0]

    if (!isGroupNode(group)) {
      throw new Error("expected group")
    }

    const field = group.childNodes.value[0]

    commitSchemas(group, [{ ...createRawFieldSchema("name", "name"), label: "新标签" }])

    expect(group.childNodes.value[0]).toBe(field)
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

    expect(isGroupNode(outer)).toBe(true)
    expect(
      isGroupNode(outer) && isGroupNode(outer.childNodes.value[0])
        ? outer.childNodes.value[0].childNodes.value[0]?.key
        : undefined
    ).toBe("email")
  })
})
