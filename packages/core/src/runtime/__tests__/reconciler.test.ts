import { describe, expect, it } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
} from "../node/__tests__/graphTestUtils"

describe("Node 协调", () => {
  it("提交 Schema 后创建、挂载对应节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("field")])

    expect(root.childNodes.value).toHaveLength(1)
    expect(root.childNodes.value[0]?.parent).toBe(root)
  })

  it("按 key 复用同类型节点并替换不同类型节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("slot")])
    const previous = root.childNodes.value[0]

    commitSchemas(root, [
      {
        key: "slot",
        label: "Group",
        children: [],
      },
    ])

    expect(root.childNodes.value[0]).not.toBe(previous)
    expect(previous?.disposed.value).toBe(true)
    expect(root.childNodes.value[0]?.type).toBe("group")
  })
})
