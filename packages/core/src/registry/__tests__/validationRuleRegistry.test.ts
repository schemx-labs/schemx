import { describe, expect, it, vi } from "vitest"

import { createValidationRuleRegistry } from "../validationRuleRegistry"

import type { StandardSchemaV1 } from "../../types/standardSchema"

declare module "../../types/rule" {
  interface ValidationRuleDefinition {
    email: string
    positive: number
  }
}

function stringSchema(id: string): StandardSchemaV1<string> {
  return {
    "~standard": {
      version: 1,
      vendor: id,
      validate: (value) => ({ value: String(value) }),
    },
  }
}

function numberSchema(id: string): StandardSchemaV1<number> {
  return {
    "~standard": {
      version: 1,
      vendor: id,
      validate: (value) => ({ value: Number(value) }),
    },
  }
}

describe("ValidationRuleRegistry", () => {
  it("注册、查询和 override=false 保持一致", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const registry = createValidationRuleRegistry()

    const first = stringSchema("first")

    const second = stringSchema("second")

    try {
      registry.register("email", first)
      registry.register("email", second, { override: false })

      expect(registry.get("email")).toBe(first)
      expect(registry.has("email")).toBe(true)
      expect(consoleWarn).toHaveBeenCalledWith(
        '[schemx] 校验规则 "email" 已存在，跳过注册'
      )
    } finally {
      consoleWarn.mockRestore()
    }
  })

  it("工厂只收到精简字段上下文", () => {
    const factory = vi.fn(() => stringSchema("email"))

    const registry = createValidationRuleRegistry()

    registry.register("email", factory)

    registry.resolve("email", {
      name: "user.email",
      label: "邮箱",
      required: true,
    })

    expect(factory).toHaveBeenCalledWith({
      name: "user.email",
      label: "邮箱",
      required: true,
    })
  })

  it("批量注册、移除、列举与清空命名规则", () => {
    const registry = createValidationRuleRegistry()

    const email = stringSchema("email")

    const positive = numberSchema("positive")

    registry.registerAll({ email, positive } as never)

    expect(registry.keys()).toEqual(["email", "positive"])
    expect(registry.size()).toBe(2)
    expect(registry.unregister("email")).toBe(true)
    expect(registry.unregister("email")).toBe(false)

    registry.clear()

    expect(registry.keys()).toEqual([])
    expect(registry.size()).toBe(0)
  })

  it("未注册规则返回 undefined，且不内置 required", () => {
    const registry = createValidationRuleRegistry()

    expect(
      registry.resolve("missing", { name: "email", label: "邮箱", required: false })
    ).toBeUndefined()
    expect(registry.has("required")).toBe(false)
  })
})
