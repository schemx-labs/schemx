/**
 * 运行时图（Runtime Graph）的节点流测试。
 *
 * 覆盖同 key 节点复用、不同 kind 的节点替换、嵌套 group 提交、removed-node
 * cleanup 观察时机等流程行为。
 *
 * @module core/runtime/node/__tests__/runtimeGraphFlow.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { RuntimeNode } from "../types"

// 运行时节点流：key 复用、kind 替换、嵌套提交与 cleanup 观察时机。
describe("runtime node flow", () => {
  it("root schema commit 复用同 key 节点并释放被移除节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      createRawFieldSchema("name", "name"),
      createRawFieldSchema("age", "age"),
    ])

    const name = root.childNodes.value[0]

    const age = root.childNodes.value[1]

    commitSchemas(root, [createRawFieldSchema("name", "name")])

    expect(root.childNodes.value).toHaveLength(1)
    expect(root.childNodes.value[0]).toBe(name)
    expect(age?.disposed.value).toBe(true)
    expect(age?.parent).toBeNull()
  })

  it("same key different kind 会替换节点并保留新结构", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("slot", "slot")])
    const first = root.childNodes.value[0]

    commitSchemas(root, [
      {
        key: "slot",
        label: "slot",
        children: [createRawFieldSchema("child", "child")],
      },
    ])

    expect(root.childNodes.value[0]).not.toBe(first)
    expect(root.childNodes.value[0]?.type).toBe("group")
    expect(
      root.childNodes.value[0]?.type === "group" &&
        root.childNodes.value[0].childNodes.value[0]?.key
    ).toBe("child")
    expect(first?.disposed.value).toBe(true)
  })

  it("nested group public commit 只推进一次结构提交", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        label: "parent",
        children: [
          {
            label: "child",
            children: [createRawFieldSchema("field", "field")],
          },
        ],
      },
    ])

    expect(root.childNodes.value).toHaveLength(1)
  })

  it("removed-node cleanup 观察到的是已经提交的新 parent.children", () => {
    // 回调创建早于 harness 返回 root，必须在创建后补充引用。
    // eslint-disable-next-line prefer-const
    let rootRef: Extract<RuntimeNode, { childNodes: unknown }> | undefined

    const unmounted = vi.fn(() => {
      expect(rootRef?.childNodes.value.map((child) => child.key)).toEqual(["next"])
    })

    const { commitSchemas, root } = createRuntimeGraphHarness({ unmounted })

    rootRef = root

    commitSchemas(root, [createRawFieldSchema("previous", "previous")])
    commitSchemas(root, [createRawFieldSchema("next", "next")])

    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  it("提交 Schema 后创建并协调 RuntimeNode", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("field")])

    expect(root.childNodes.value[0]?.key).toBe("field")
  })
})
