import { describe, expect, it } from "vitest"

import {
  createValidationCancelled,
  createValidationFailure,
  createValidationSuccess,
} from "../../index"

import type { ValidationError } from "../../index"

describe("validation result factories", () => {
  it("拒绝没有错误的普通失败结果", () => {
    expect(() => createValidationFailure({ email: "" }, [])).toThrow(TypeError)
  })

  it("复制错误数组，保留错误顺序和原始原因", () => {
    // 工厂只复制错误列表，保留错误对象及其原因的引用。
    const cause = new Error("server rejected")

    const fieldError: ValidationError<"email"> = {
      scope: "field",
      name: "email",
      issues: [{ type: "external", message: "邮箱已存在", code: "email_taken", cause }],
    }

    const formError: ValidationError = {
      scope: "form",
      issues: [{ message: "无法提交表单" }],
    }

    const errors: ValidationError<"email">[] = [fieldError, formError]

    const failure = createValidationFailure({ email: "invalid" }, errors)

    errors.length = 0

    expect(failure.errors).toEqual([fieldError, formError])
    expect(failure.errors[0]).toBe(fieldError)
    expect(failure.errors[0]?.issues[0].cause).toBe(cause)
  })

  it("保留调用方提供的值引用，由调用方控制快照时机", () => {
    const values = { email: "user@example.com" }

    const error: ValidationError = {
      scope: "form",
      issues: [{ message: "依赖解析超时" }],
    }

    expect(createValidationSuccess(values).values).toBe(values)
    expect(createValidationCancelled(values).values).toBe(values)
    expect(createValidationFailure(values, [error]).values).toBe(values)
  })
})
