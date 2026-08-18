import { describe, expect, it } from "vitest"

import { getSectionPosition, normalizeId, normalizeNameKey } from "../helpers"

import type { SchemxViewSchema } from "@schemx/core"

describe("getSectionPosition", () => {
  it("将可见 Group 视为区段边界", () => {
    const schemas = [
      field("before"),
      group("section"),
      field("after"),
    ] as SchemxViewSchema[]

    expect(getSectionPosition(schemas, "before")).toMatchObject({
      found: true,
      isFirst: true,
      isLast: true,
    })
    expect(getSectionPosition(schemas, "after")).toMatchObject({
      found: true,
      isFirst: true,
      isLast: true,
    })
  })

  it("跳过不可见项，并根据 children 而非 componentType 判断 Group", () => {
    const schemas = [
      field("before"),
      hiddenField("hidden"),
      field("renderer-group", "group"),
      hiddenGroup("hidden-section"),
      field("after"),
    ] as SchemxViewSchema[]

    expect(getSectionPosition(schemas, "renderer-group")).toMatchObject({
      found: true,
      isFirst: false,
      isLast: false,
    })
  })
})

describe("normalize helpers", () => {
  it("应将 NamePath 转换为稳定的插槽键", () => {
    expect(normalizeNameKey(["user", 0, "name"])).toBe("user.0.name")
    expect(normalizeNameKey("user.name")).toBe("user.name")
  })

  it("应将分组 key 转换为安全的 DOM ID 片段", () => {
    expect(normalizeId("profile/basic")).toBe("profile-basic")
    expect(normalizeId("profile.basic")).toBe("profile-basic")
  })
})

function field(key: string, componentType = "input") {
  return {
    key,
    name: key,
    label: key,
    componentType,
    visible: true,
  }
}

function hiddenField(key: string) {
  return { ...field(key), visible: false }
}

function group(key: string) {
  return {
    key,
    label: key,
    visible: true,
    children: [],
  }
}

function hiddenGroup(key: string) {
  return { ...group(key), visible: false }
}
