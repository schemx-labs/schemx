import fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { createValidator } from "../validator"

import type { ValidationRule, ValidationRuleResult } from "../types"

/**
 * 覆盖字段路径、错误聚合和取消行为的测试表单。
 */
interface TestForm {
  name: string
  age: number
  email: string
}

/**
 * 各校验器测试默认使用的表单快照。
 */
const baseValues: TestForm = { name: "John", age: 25, email: "j@t.com" }

/**
 * 创建通过校验的测试规则。
 */
const passingRule = (): ValidationRule<string, TestForm, "name"> => ({
  validate: () => ({ valid: true }),
})

/**
 * 创建带指定消息的失败测试规则。
 *
 * @param message - 规则返回的错误消息。
 */
const failingRule = (message: string): ValidationRule<string, TestForm, "name"> => ({
  validate: () => ({ valid: false, issues: [{ message }] }),
})

/**
 * 创建抛出指定异常的测试规则。
 *
 * @param error - 规则执行时抛出的异常。
 */
const throwingRule = (error: Error): ValidationRule<string, TestForm, "name"> => ({
  validate: () => {
    throw error
  },
})

/**
 * 创建可由测试手动完成的 Promise。
 */
const deferred = <TValue>() => {
  let resolve!: (value: TValue) => void

  const promise = new Promise<TValue>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

/**
 * 创建按调用顺序返回两个异步结果的测试规则。
 *
 * @param first - 第一次调用返回的结果。
 * @param second - 后续调用返回的结果。
 */
const sequencedRule = (
  first: Promise<ValidationRuleResult>,
  second: Promise<ValidationRuleResult>
): ValidationRule<string, TestForm, "name"> => {
  let count = 0

  return {
    validate: () => (count++ === 0 ? first : second),
  }
}

/**
 * 创建记录 AbortSignal 且保持挂起的测试规则。
 *
 * @param signals - 接收规则上下文中取消信号的数组。
 */
const captureSignalRule = (
  signals: AbortSignal[]
): ValidationRule<string, TestForm, "name"> => ({
  validate: (_value, context) => {
    signals.push(context.signal)

    return new Promise<ValidationRuleResult>(() => undefined)
  },
})

describe("Validator", () => {
  it("setFieldRules 使用替换语义", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [failingRule("旧错误")])
    validator.setFieldRules("name", [passingRule()])

    await expect(validator.validateField("name", baseValues)).resolves.toEqual({
      valid: true,
      values: baseValues,
      errors: [],
    })
  })

  it("支持规则和错误的单字段与多字段操作", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldsRules([
      { name: "name", rules: [failingRule("姓名错误")] },
      {
        name: "email",
        rules: [
          { validate: () => ({ valid: false, issues: [{ message: "邮箱错误" }] }) },
        ],
      },
    ])
    validator.setFieldsErrors([
      { name: "name", messages: ["姓名已存在"] },
      { name: "age", messages: ["年龄无效"] },
    ])

    await validator.validate(baseValues)

    expect(validator.getFieldsErrors(["age", "name"])).toEqual([
      { name: "age", errors: ["年龄无效"] },
      { name: "name", errors: ["姓名错误", "姓名已存在"] },
    ])

    validator.clearFieldsErrors(["name"])
    expect(validator.getFieldErrors("name")).toEqual([])
    validator.clearFieldsErrors(["age"])

    validator.setFieldsConfigurationIssues([
      { name: "age", issues: [{ message: "年龄规则配置错误" }] },
    ])
    expect(validator.getFieldErrors("age")).toEqual(["年龄规则配置错误"])
    validator.clearFieldsConfigurationIssues(["age"])

    validator.removeFieldsRules(["name", "email"])
    await expect(validator.validate(baseValues)).resolves.toMatchObject({
      valid: true,
      errors: [],
    })
  })

  it("等价字符串与数组路径共享同一字段身份", async () => {
    const validator = createValidator<{ profile: { email: string } }>()

    validator.setFieldRules("profile.email", [
      { validate: () => ({ valid: false, issues: [{ message: "邮箱错误" }] }) },
    ])

    await expect(
      validator.validateField(["profile", "email"] as never, {
        profile: { email: "invalid" },
      })
    ).resolves.toMatchObject({
      valid: false,
      errors: [{ name: ["profile", "email"], issues: [{ message: "邮箱错误" }] }],
    })
    expect(validator.getFieldErrors("profile.email")).toEqual(["邮箱错误"])
  })

  it("getFieldErrors 无错误时稳定返回只读空数组", () => {
    const validator = createValidator<TestForm>()

    expect(validator.getFieldErrors("name")).toEqual([])
    expect(validator.getFieldErrors("name")).toBe(validator.getFieldErrors("name"))
    expect(Object.isFrozen(validator.getFieldErrors("name"))).toBe(true)
  })

  it("规则与 external 错误均复制调用方输入，并隔离返回消息", async () => {
    const validator = createValidator<TestForm>()

    const rules: ValidationRule<string, TestForm, "name">[] = [failingRule("原始规则")]

    const messages = ["原始消息"]

    validator.setFieldRules("name", rules)
    validator.setFieldErrors("name", messages)

    rules.splice(0, 1, passingRule())
    messages[0] = "被调用方改写"
    const returnedMessages = validator.getFieldErrors("name") as string[]

    returnedMessages[0] = "被消费者改写"

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      valid: false,
      errors: [
        {
          issues: [{ message: "原始规则" }, { message: "原始消息", code: "external" }],
        },
      ],
    })
    expect(validator.getFieldErrors("name")).toEqual(["原始规则", "原始消息"])
  })

  it("规则异常通过 onRuleError 转换", async () => {
    const error = new Error("boom")

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createValidator<TestForm>({
      onRuleError: (error) => `执行异常: ${(error as Error).message}`,
    })

    validator.setFieldRules("name", [throwingRule(error)])

    try {
      const result = await validator.validateField("name", baseValues)

      expect(result).toMatchObject({
        valid: false,
        errors: [
          {
            scope: "field",
            name: "name",
            issues: [{ message: "执行异常: boom", code: "rule_execution" }],
          },
        ],
      })
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] 字段 "name" 校验规则执行错误',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("规则异常未配置 onRuleError 时使用默认提示", async () => {
    const error = new Error("boom")

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [throwingRule(error)])

    try {
      await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
        valid: false,
        errors: [
          {
            scope: "field",
            name: "name",
            issues: [{ message: "校验执行失败", code: "rule_execution" }],
          },
        ],
      })
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] 字段 "name" 校验规则执行错误',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("旧异步结果不能覆盖新状态", async () => {
    const first = deferred<ValidationRuleResult>()

    const second = deferred<ValidationRuleResult>()

    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [sequencedRule(first.promise, second.promise)])

    const oldRun = validator.validateField("name", { ...baseValues, name: "old" })

    const newRun = validator.validateField("name", { ...baseValues, name: "new" })

    second.resolve({ valid: true })
    await newRun
    first.resolve({ valid: false, issues: [{ message: "旧错误" }] })
    await oldRun

    expect(validator.getFieldErrors("name")).toEqual([])
  })

  it("替换规则会取消旧运行，并拒绝旧规则回写", async () => {
    const pending = deferred<ValidationRuleResult>()

    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [{ validate: () => pending.promise }])

    const oldRun = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.setFieldRules("name", [failingRule("新规则错误")])
    pending.resolve({ valid: false, issues: [{ message: "旧规则错误" }] })

    await expect(oldRun).resolves.toMatchObject({ cancelled: true, errors: [] })
    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ message: "新规则错误" }] }],
    })
    expect(validator.getFieldErrors("name")).toEqual(["新规则错误"])
  })

  it("external 错误会阻止全表校验通过，即使字段没有规则", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldErrors("email", ["服务端已占用"])

    await expect(validator.validate(baseValues)).resolves.toEqual({
      valid: false,
      values: baseValues,
      errors: [
        {
          scope: "field",
          name: "email",
          issues: [{ message: "服务端已占用", code: "external" }],
        },
      ],
    })
  })

  it("非法空 issue 失败结果转换为规则执行错误", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [
      { validate: () => ({ valid: false, issues: [] }) as never },
    ])

    try {
      await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
        errors: [{ issues: [{ code: "rule_execution" }] }],
      })
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] 字段 "name" 校验规则执行错误',
        expect.any(TypeError)
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("destroy 中止运行并清空全部状态", async () => {
    const validator = createValidator<TestForm>()

    const signals: AbortSignal[] = []

    validator.setFieldRules("name", [captureSignalRule(signals)])
    void validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()
    validator.destroy()

    expect(signals[0].aborted).toBe(true)
    expect(validator.getFieldErrors("name")).toEqual([])
  })

  it("规则因 abort 拒绝时不产生可见错误", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [
      {
        validate: (_value, context) =>
          new Promise<ValidationRuleResult>((_resolve, reject) => {
            context.signal.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true,
            })
          }),
      },
    ])

    const validation = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values: baseValues,
      errors: [],
    })
    expect(validator.getFieldErrors("name")).toEqual([])
  })

  it("destroy 后旧运行完成也不会回写错误", async () => {
    const result = deferred<ValidationRuleResult>()

    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [{ validate: () => result.promise }])

    const validation = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()
    result.resolve({ valid: false, issues: [{ message: "过期错误" }] })

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values: baseValues,
      errors: [],
    })
    expect(validator.getFieldErrors("name")).toEqual([])
  })

  it("失败规则聚合信息，bail 停止后续规则", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [
      failingRule("第一个错误"),
      {
        validate: () => ({
          valid: false,
          issues: [{ message: "必填错误" }],
          bail: true,
        }),
      },
      failingRule("不应出现"),
    ])

    await expect(validator.validateField("name", baseValues)).resolves.toEqual({
      valid: false,
      values: baseValues,
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ message: "第一个错误" }, { message: "必填错误" }],
        },
      ],
    })
  })

  it("validate 顺序校验全部已配置字段", async () => {
    const validator = createValidator<TestForm>()

    validator.setFieldRules("name", [failingRule("姓名错误")])
    validator.setFieldRules("email", [
      { validate: () => ({ valid: false, issues: [{ message: "邮箱错误" }] }) },
    ])

    await expect(validator.validate(baseValues)).resolves.toEqual({
      valid: false,
      values: baseValues,
      errors: [
        { scope: "field", name: "name", issues: [{ message: "姓名错误" }] },
        { scope: "field", name: "email", issues: [{ message: "邮箱错误" }] },
      ],
    })
  })
})

describe("Validator 错误 signal 属性测试", () => {
  it("Property 11: setFieldErrors 后 getFieldErrors 返回相等值，clearErrors 后返回空数组", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        (path, errors) => {
          const validator = createValidator<Record<string, unknown>>()

          validator.setFieldErrors(path, errors)
          expect(validator.getFieldErrors(path)).toEqual(errors)

          validator.clearErrors()
          expect(validator.getFieldErrors(path)).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })
})
