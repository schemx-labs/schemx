import { describe, expect, it } from "vitest"

import type { SchemxField } from "../schema"

describe("SchemxField 容器结构类型", () => {
  it("允许无 componentType 的 Group 和 Dependency", () => {
    const group = {
      label: "资料",
      children: [],
    } satisfies SchemxField

    const dependency = {
      to: ["mode"],
      renderer: () => [],
    } satisfies SchemxField

    expect(group.children).toEqual([])
    expect(dependency.to).toEqual(["mode"])
  })

  it("普通字段仍要求 componentType", () => {
    // @ts-expect-error 普通字段缺少 Renderer key。
    const field: SchemxField = { name: "name", label: "姓名" }

    expect(field).toBeDefined()
  })

  it("拒绝旧容器 componentType 语法", () => {
    const group: SchemxField = {
      // @ts-expect-error Group 不再接受 componentType。
      componentType: "group",
      label: "资料",
      children: [],
    }

    const dependency: SchemxField = {
      // @ts-expect-error Dependency 不再接受 componentType。
      componentType: "dependency",
      to: ["mode"],
      renderer: () => [],
    }

    expect(group).toBeDefined()
    expect(dependency).toBeDefined()
  })
})
