/**
 * Validator 单元测试
 *
 * 覆盖 Validator 的所有公开 API：
 * register、unregister、getFieldError、setFieldError、
 * reset、validateField、validate。
 *
 * @module core/validator/__tests__/validator
 */

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createValidator } from "../validator"
import { createRequiredRule } from "../defaultRules"

import type { StandardSchemaV1 } from "../../types/standardSchema"

interface TestForm {
  name: string
  age: number
  email: string
}

/**
 * 创建一个简单的最小长度校验 schema
 *
 * @param min - 最小长度
 * @param msg - 错误信息
 */
const createMinLengthSchema = (min: number, msg: string): StandardSchemaV1 => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate(value: unknown) {
      if (typeof value === "string" && value.length >= min) {
        return { value }
      }

      return { issues: [{ message: msg }] }
    },
  },
})

/**
 * 创建一个异步校验 schema
 *
 * @param delay - 延迟毫秒数
 * @param shouldPass - 是否通过
 * @param msg - 错误信息
 */
const createAsyncSchema = (
  delay: number,
  shouldPass: boolean,
  msg: string
): StandardSchemaV1 => ({
  "~standard": {
    version: 1,
    vendor: "test",
    async validate(value: unknown) {
      await new Promise((r) => setTimeout(r, delay))
      if (shouldPass) return { value }

      return { issues: [{ message: msg }] }
    },
  },
})

const baseValues: TestForm = { name: "John", age: 25, email: "j@t.com" }

describe("Validator", () => {
  describe("register / unregister", () => {
    it("注册规则后可校验", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"))

      const result = await v.validateField("name", { ...baseValues, name: "A" })
      expect(result.ok).toBe(false)
    })

    it("注销规则后校验通过", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"))
      v.unregister("name")

      const result = await v.validateField("name", baseValues)
      expect(result.ok).toBe(true)
    })

    it("注销规则同时清除该字段错误", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"))
      await v.validateField("name", { ...baseValues, name: "A" })
      expect(v.getFieldError("name")).toBeDefined()

      v.unregister("name")
      expect(v.getFieldError("name")).toBeUndefined()
    })

    it("注销字段时也会清除手动设置的残留错误", () => {
      const v = createValidator<TestForm>()
      v.setFieldError("name", ["旧错误"])

      v.unregister("name")

      expect(v.getFieldError("name")).toBeUndefined()
    })

    it("register 带 defaultMessage 空值拦截", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"), "姓名不能为空")

      const result = await v.validateField("name", {
        ...baseValues,
        name: undefined as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("姓名不能为空")
      }
    })
  })

  describe("getFieldError / setFieldError / resetErrors", () => {
    it("无错误时返回 undefined", () => {
      const v = createValidator<TestForm>()
      expect(v.getFieldError("name")).toBeUndefined()
    })

    it("手动设置错误", () => {
      const v = createValidator<TestForm>()
      v.setFieldError("name", ["错误1", "错误2"])
      expect(v.getFieldError("name")).toEqual(["错误1", "错误2"])
    })

    it("reset 清空所有错误", () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(1, "err"))
      v.register("email", createMinLengthSchema(1, "err"))
      v.setFieldError("name", ["错误1"])
      v.setFieldError("email", ["错误2"])
      v.reset()
      expect(v.getFieldError("name")).toEqual([])
      expect(v.getFieldError("email")).toEqual([])
    })
  })

  describe("validateField", () => {
    it("无规则字段校验通过", async () => {
      const v = createValidator<TestForm>()
      const result = await v.validateField("name", baseValues)
      expect(result.ok).toBe(true)
    })

    it("校验通过时清除该字段错误", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"))

      // 先让校验失败
      await v.validateField("name", { ...baseValues, name: "A" })
      expect(v.getFieldError("name")).toBeDefined()

      // 再让校验通过
      await v.validateField("name", { ...baseValues, name: "John" })
      expect(v.getFieldError("name")).toBeUndefined()
    })

    it("校验失败时记录错误", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "至少2个字符"))

      const result = await v.validateField("name", { ...baseValues, name: "A" })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors).toHaveLength(1)
        expect(result.error.errors[0].field).toBe("name")
        expect(result.error.errors[0].message).toContain("至少2个字符")
      }
    })

    it("支持路径数组批量校验", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(2, "姓名至少2个字符"))
      v.register("email", createRequiredRule({ label: "邮箱" } as any))

      const result = await v.validateField(["name", "email"], {
        ...baseValues,
        name: "A",
        email: "",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors).toHaveLength(2)
      }
    })

    it("支持异步校验规则", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createAsyncSchema(10, false, "异步校验失败"))

      const result = await v.validateField("name", baseValues)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("异步校验失败")
      }
    })

    it("null 值触发 defaultMessage", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(1, "至少1个字符"), "必填")

      const result = await v.validateField("name", {
        ...baseValues,
        name: null as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("必填")
      }
    })
  })

  describe("validate（全量校验）", () => {
    it("所有字段通过时返回 ok", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(1, "至少1个字符"))
      v.register("email", createRequiredRule({ label: "邮箱" } as any))

      const result = await v.validate(baseValues)
      expect(result.ok).toBe(true)
    })

    it("部分字段失败时返回所有错误", async () => {
      const v = createValidator<TestForm>()
      v.register("name", createMinLengthSchema(10, "姓名至少10个字符"))
      v.register("email", createRequiredRule({ label: "邮箱" } as any))

      const result = await v.validate({ ...baseValues, name: "A", email: "" })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors).toHaveLength(2)
      }
    })

    it("validate 前清空旧错误", async () => {
      const v = createValidator<TestForm>()
      v.setFieldError("name", ["手动设置的错误"])
      v.register("email", createRequiredRule({ label: "邮箱" } as any))

      const result = await v.validate({ ...baseValues, email: "valid@t.com" })
      expect(result.ok).toBe(true)
      expect(v.getFieldError("name")).toBeUndefined()
      expect(v.getFieldError("email")).toBeUndefined()
    })
  })

  describe("createValidator 工厂函数", () => {
    it("创建 Validator 实例", () => {
      const v = createValidator<TestForm>()
      expect(v).toBeDefined()
    })
  })
})

describe("Validator 错误 signal 属性测试", () => {
  // Feature: signal-map-abstraction, Property 11: Validator 错误 signal 往返一致性
  // **Validates: Requirements 3.4, 3.5, 3.6, 4.1, 4.3, 4.4**
  it("Property 11: setFieldError 后 getFieldError 返回相等值，reset 后返回空数组或 undefined", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        (path, errors) => {
          const v = createValidator<Record<string, any>>()

          // setFieldError 后 getFieldError 应返回相等值
          v.setFieldError(path, errors)
          expect(v.getFieldError(path)).toEqual(errors)

          // reset 后，未注册 rules 的字段错误被清除
          v.reset()
          expect(v.getFieldError(path)).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: pure-signal-core-refactor, Property 9: Validator 错误往返一致性与 effect 追踪
// 注意：Validator 已重构为使用 ReactiveMap 管理错误。
// 本属性测试聚焦于 setFieldError/getFieldError 往返一致性、reset 清空。
// **Validates: Requirements 6.2, 6.3, 6.4**
describe("Validator 错误往返一致性（P9）", () => {
  it("Property 9: 对于任意路径和错误数组，setFieldError 后 getFieldError 返回相同值，reset 清空所有错误", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        (pathA, pathB, errorsA, errorsB) => {
          const v = createValidator<Record<string, any>>()

          // 设置字段 A 的错误
          v.setFieldError(pathA, errorsA)
          expect(v.getFieldError(pathA)).toEqual(errorsA)

          // 设置字段 B 的错误，不影响字段 A（当路径不同时）
          v.setFieldError(pathB, errorsB)
          expect(v.getFieldError(pathB)).toEqual(errorsB)

          // 如果路径不同，字段 A 的错误应保持不变
          if (pathA !== pathB) {
            expect(v.getFieldError(pathA)).toEqual(errorsA)
          }

          // reset 清空所有字段的错误（未注册 rules 的字段被删除）
          v.reset()
          expect(v.getFieldError(pathA)).toBeUndefined()
          expect(v.getFieldError(pathB)).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("Validator getFieldError 无错误", () => {
  it("getFieldError 无错误时返回 undefined", () => {
    const v = createValidator<TestForm>()
    expect(v.getFieldError("name")).toBeUndefined()
  })
})
