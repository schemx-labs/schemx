/**
 * diff 对象浅层差异比较单元测试
 *
 * 覆盖属性值不同、完全相同、嵌套对象深度比较、新增属性、空对象。
 *
 * @module utils/__tests__/diff
 */
import { describe, expect, it } from "vitest"

import { diff } from "../../../../vue/src/utils/diff"

describe("diff", () => {
  it("属性值不同时返回变化的属性新值", () => {
    const result = diff({ a: 1, b: 2 }, { a: 1, b: 3 })
    expect(result).toEqual({ b: 2 })
  })

  it("完全相同的对象返回空对象", () => {
    const result = diff({ a: 1, b: "hello" }, { a: 1, b: "hello" })
    expect(result).toEqual({})
  })

  it("嵌套对象使用深度比较", () => {
    const result = diff({ data: { x: 1, y: 2 } }, { data: { x: 1, y: 2 } })
    expect(result).toEqual({})

    const result2 = diff({ data: { x: 1, y: 3 } }, { data: { x: 1, y: 2 } })
    expect(result2).toEqual({ data: { x: 1, y: 3 } })
  })

  it("current 包含 prev 中不存在的新属性", () => {
    const result = diff({ a: 1, b: 2 } as any, { a: 1 } as any)
    expect(result).toEqual({ b: 2 })
  })

  it("两个空对象返回空对象", () => {
    const result = diff({}, {})
    expect(result).toEqual({})
  })
})
