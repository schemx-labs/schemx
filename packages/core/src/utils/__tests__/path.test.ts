/**
 * path 路径工具单元测试
 *
 * 覆盖 getByPath、setByPath、collectObjectPathsByLeaf。
 *
 * @module utils/__tests__/path
 */
import { describe, expect, it } from "vitest"

import { collectObjectPathsByLeaf, getByPath, setByPath } from "../path"

describe("getByPath", () => {
  it("有效嵌套路径返回对应值", () => {
    const obj = { user: { address: { city: "Beijing" } } }
    expect(getByPath(obj, "user.address.city")).toBe("Beijing")
  })

  it("空字符串路径返回整个对象", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, "")).toBe(obj)
  })

  it("空数组路径返回整个对象", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, [])).toBe(obj)
  })

  it("不存在的路径返回 undefined", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, "b.c")).toBeUndefined()
  })
})

describe("setByPath", () => {
  it("有效路径设置嵌套值", () => {
    const obj: Record<string, any> = { user: {} }
    setByPath(obj, "user.name", "John")
    expect(obj.user.name).toBe("John")
  })

  it("null 对象不抛异常", () => {
    expect(() => setByPath(null as any, "a", 1)).not.toThrow()
  })

  it("undefined 对象不抛异常", () => {
    expect(() => setByPath(undefined as any, "a", 1)).not.toThrow()
  })
})

describe("collectObjectPathsByLeaf", () => {
  it("仅返回叶子节点路径", () => {
    const obj = { name: "a", address: { city: "BJ", zip: "100000" } }
    const paths = collectObjectPathsByLeaf(obj)
    expect(paths).toContain("name")
    expect(paths).toContain("address.city")
    expect(paths).toContain("address.zip")
    expect(paths).not.toContain("address")
  })

  it("数组叶子节点", () => {
    const obj = { tags: [1, 2] }
    const paths = collectObjectPathsByLeaf(obj)
    expect(paths).toContain("tags[0]")
    expect(paths).toContain("tags[1]")
    expect(paths).not.toContain("tags")
  })
})
