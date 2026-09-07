/**
 * createSchemas 单元测试
 *
 * 验证 createSchemas 工厂函数创建的 schema source 支持 set/update/subscribe 管理。
 *
 * @module core/__tests__/createSchemas
 */
import { describe, expect, it, vi } from "vitest"

import { createSchemas } from "../createSchemas"

interface TestValues {
  name: string
  email?: string
}

// 验证 createSchemas 的 set/update/subscribe 完整工作流程
describe("createSchemas", () => {
  it("支持 set/update/subscribe 管理 schema source", () => {
    const schemas = createSchemas<TestValues>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    const onChange = vi.fn()

    const unsubscribe = schemas.subscribe(onChange)

    schemas.set([{ name: "email", label: "邮箱", componentType: "input" }])
    schemas.update((current) => [
      ...current,
      { name: "name", label: "姓名", componentType: "input" },
    ])

    expect(schemas.peek()).toEqual([
      { name: "email", label: "邮箱", componentType: "input" },
      { name: "name", label: "姓名", componentType: "input" },
    ])
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    schemas.set([])

    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
