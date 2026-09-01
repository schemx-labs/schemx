import { describe, expect, it } from "vitest"

import { normalizeSchemas } from "../normalize"

describe("normalizeSchemas", () => {
  it("拒绝跨层重复字段名并报告两个 Schema 路径", () => {
    expect(() =>
      normalizeSchemas(
        [
          { name: "name", label: "姓名", componentType: "text" },
          {
            label: "分组",
            children: [{ name: "name", label: "重复姓名", componentType: "text" }],
          },
        ],
        "text"
      )
    ).toThrow(
      '[schemx] Duplicate field name "name" at schemas[0] and schemas[1].children[0].'
    )
  })

  it("拒绝不同 group 分支中的重复字段名", () => {
    expect(() =>
      normalizeSchemas(
        [
          {
            label: "分组一",
            children: [{ name: "email", label: "邮箱", componentType: "text" }],
          },
          {
            label: "分组二",
            children: [{ name: "email", label: "重复邮箱", componentType: "text" }],
          },
        ],
        "text"
      )
    ).toThrow(
      '[schemx] Duplicate field name "email" at schemas[0].children[0] and schemas[1].children[0].'
    )
  })
})
