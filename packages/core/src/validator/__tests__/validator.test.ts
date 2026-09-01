import fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { createPresetRuleRegistry } from "../../registry"
import { createStore } from "../../store"
import { createValidator } from "../validator"

import type { PresetRuleFactoryContext, PresetRuleRegistry } from "../../registry"
import type { Store } from "../../store"
import type { FieldRules, NamePath, Values } from "../../types"
import type {
  ValidationAdapter,
  ValidationAdapterOption,
  ValidationRule,
  ValidationRuleIssue,
  ValidationRuleResult,
  Validator,
} from "../types"
import type { CreateValidatorOptions } from "../validator"

/**
 * 覆盖字段路径、错误聚合和取消行为的测试表单。
 */
interface TestForm {
  name: string
  age: number
  email: string
}

/** 覆盖 FieldArray 配置失效的测试表单。 */
interface ArrayForm {
  users: Array<{
    name: string
  }>
}

/**
 * 各校验器测试默认使用的表单快照。
 */
const baseValues: TestForm = { name: "John", age: 25, email: "j@t.com" }

/** Validator 测试工厂的可选覆盖配置。 */
interface TestValidatorOptions<TValues extends Values> extends Pick<
  CreateValidatorOptions<TValues>,
  "onRuleError" | "validationConcurrency"
> {
  /** 测试用的字段状态 Store。 */
  readonly fieldStore?: Store<TValues>
  /** 测试用的命名规则 Registry。 */
  readonly presetRuleRegistry?: PresetRuleRegistry
  /** 测试用的 adapter 列表。 */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]
}

/** 创建带有必传 Registry 和 Store 的 Validator。 */
function createTestValidator<TValues extends Values>(
  options: TestValidatorOptions<TValues> = {}
): Validator<TValues> {
  return createValidator({
    presetRuleRegistry: options.presetRuleRegistry ?? createPresetRuleRegistry(),
    fieldStore: options.fieldStore ?? createStore<TValues>(),
    validatorAdapters: options.validatorAdapters,
    onRuleError: options.onRuleError,
    validationConcurrency: options.validationConcurrency,
  })
}

/** 为测试字段写入统一的原始规则配置。 */
function setTestRules<TValues extends Values, TName extends NamePath<TValues>>(
  validator: Validator<TValues>,
  name: TName,
  rules: FieldRules<TValues, TName>
): void {
  validator.setFieldConfig({
    name,
    label: String(name),
    required: undefined,
  })
  validator.setFieldRules(name, rules)
}

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
  validate: () => ({ valid: false, issues: [{ type: "validation", message }] }),
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
  it("应读取注入 Store 中的错误", async () => {
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    fieldStore.setFieldErrors("email", [
      { type: "external", message: "服务端已占用", code: "external" },
    ])

    expect(fieldStore.getFieldErrors("email")).toEqual([
      { type: "external", message: "服务端已占用", code: "external" },
    ])

    await expect(
      validator.validate({ name: "John", age: 25, email: "" })
    ).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "email" }],
    })
  })

  it("Registry 命中时优先解析并传递字段配置", async () => {
    const presetRuleRegistry = createPresetRuleRegistry()

    const resolvePreset = vi.fn((context: PresetRuleFactoryContext) => ({
      validate: () => ({
        valid: false as const,
        issues: [
          {
            type: "validation" as const,
            message: `${context.label}:${String(context.required)}`,
          },
        ],
      }),
    }))

    presetRuleRegistry.register("preset" as never, resolvePreset as never)

    const adapterResolve = vi.fn()

    const adapter: ValidationAdapter = {
      id: "adapter",
      isRule: (rule) => rule === "preset",
      resolve: (rule) => {
        adapterResolve(rule)

        return [{ validate: () => ({ valid: true as const }) }]
      },
    }

    const validator = createTestValidator<TestForm>({
      presetRuleRegistry,
      validatorAdapters: [adapter],
    })

    validator.setFieldConfig({
      name: "name",
      label: "姓名",
      required: true,
    })
    validator.setFieldRules("name", "preset" as never)

    expect(resolvePreset).not.toHaveBeenCalled()

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ message: "姓名:true" }] }],
    })
    expect(resolvePreset).toHaveBeenCalledWith({
      name: "name",
      label: "姓名",
      required: true,
    })
    expect(adapterResolve).not.toHaveBeenCalled()
  })

  it("Registry 未命中时按 adapter 注册顺序使用首个匹配项", async () => {
    const firstIsRule = vi.fn((rule: unknown) => rule === "adapter-rule")

    const secondIsRule = vi.fn((rule: unknown) => rule === "adapter-rule")

    const firstResolve = vi.fn()

    const secondResolve = vi.fn()

    const firstAdapter: ValidationAdapter = {
      id: "first",
      isRule: firstIsRule,
      resolve: (rule) => {
        firstResolve(rule)

        return [
          {
            validate: () => ({
              valid: false as const,
              issues: [{ type: "validation" as const, message: "首个 adapter 错误" }],
            }),
          },
        ]
      },
    }

    const secondAdapter: ValidationAdapter = {
      id: "second",
      isRule: secondIsRule,
      resolve: (rule) => {
        secondResolve(rule)

        return [
          {
            validate: () => ({
              valid: false as const,
              issues: [{ type: "validation" as const, message: "第二个 adapter 错误" }],
            }),
          },
        ]
      },
    }

    const validator = createTestValidator<TestForm>({
      validatorAdapters: [firstAdapter, secondAdapter],
    })

    setTestRules(validator, "name", "adapter-rule" as never)

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ message: "首个 adapter 错误" }] }],
    })
    expect(firstIsRule).toHaveBeenCalledWith("adapter-rule")
    expect(firstResolve).toHaveBeenCalledWith("adapter-rule")
    expect(secondIsRule).not.toHaveBeenCalled()
    expect(secondResolve).not.toHaveBeenCalled()
  })

  it("配置保存后才解析 Registry，并使用注册表的最新规则", async () => {
    const presetRuleRegistry = createPresetRuleRegistry()

    const validator = createTestValidator<TestForm>({ presetRuleRegistry })

    validator.setFieldConfig({
      name: "name",
      label: "姓名",
      required: false,
    })
    validator.setFieldRules("name", "preset" as never)

    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ code: "validation_config" }] }],
    })

    presetRuleRegistry.register("preset" as never, {
      validate: () => ({
        valid: false,
        issues: [{ type: "validation", message: "最新规则" }],
      }),
    })

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ message: "最新规则" }] }],
    })

    expect(consoleWarn).toHaveBeenCalledTimes(1)
    consoleWarn.mockRestore()
    consoleError.mockRestore()
  })

  it("required 规则先于字段附加规则执行", async () => {
    const extraRule = vi.fn(() => ({
      valid: false as const,
      issues: [{ type: "validation" as const, message: "附加规则错误" }],
    }))

    const validator = createTestValidator<TestForm>()

    validator.setFieldConfig({
      name: "name",
      label: "姓名",
      required: true,
    })
    validator.setFieldRules("name", [{ validate: extraRule }])

    await expect(
      validator.validateField("name", { ...baseValues, name: "" })
    ).resolves.toMatchObject({
      errors: [{ issues: [{ code: "required" }] }],
    })
    expect(extraRule).not.toHaveBeenCalled()
  })

  it("adapter 解析失败时写入 configuration 错误且不执行部分规则", async () => {
    const badAdapter: ValidationAdapter = {
      id: "bad",
      isRule: (rule) => rule === "bad-rule",
      resolve: () => [],
    }

    const validator = createTestValidator<TestForm>({ validatorAdapters: [badAdapter] })

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    setTestRules(validator, "name", [
      failingRule("不应执行"),
      "bad-rule" as never,
    ] as never)

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ type: "configuration", code: "validation_config" }] }],
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[schemx] 字段 "name" 校验配置错误',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })

  it("未提供自定义 adapter 时使用内置 Standard Schema adapter", async () => {
    const validator = createTestValidator<TestForm>()

    const schema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: () => ({ issues: [{ message: "Standard Schema 错误" }] }),
      },
    }

    setTestRules(validator, "name", schema as never)

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ type: "validation", message: "Standard Schema 错误" }] }],
    })
  })

  it("整表校验应遵守字段并发上限", async () => {
    type ManyFields = Record<string, number>

    const validator = createTestValidator<ManyFields>({ validationConcurrency: 2 })

    const values: ManyFields = {}

    let active = 0

    let maxActive = 0

    for (let index = 0; index < 6; index++) {
      const name = `field-${index}`

      values[name] = index
      setTestRules(validator, name, [
        {
          validate: async () => {
            active += 1
            maxActive = Math.max(maxActive, active)
            await Promise.resolve()
            active -= 1

            return { valid: true }
          },
        },
      ])
    }

    await expect(validator.validate(values)).resolves.toMatchObject({ valid: true })
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it("setFieldRules 使用替换语义", async () => {
    const validator = createTestValidator<TestForm>()

    setTestRules(validator, "name", [failingRule("旧错误")])
    setTestRules(validator, "name", [passingRule()])

    await expect(validator.validateField("name", baseValues)).resolves.toEqual({
      valid: true,
      values: baseValues,
      errors: [],
    })
  })

  it("支持规则和错误的单字段与多字段操作", async () => {
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    setTestRules(validator, "name", [failingRule("姓名错误")])
    setTestRules(validator, "email", [
      {
        validate: () => ({
          valid: false,
          issues: [{ type: "validation", message: "邮箱错误" }],
        }),
      },
    ])
    fieldStore.setFieldsErrors([
      {
        field: "name",
        errors: [{ type: "external", message: "姓名已存在", code: "external" }],
      },
      {
        field: "age",
        errors: [{ type: "external", message: "年龄无效", code: "external" }],
      },
    ])

    await validator.validate(baseValues)

    expect(fieldStore.getFieldsErrors(["age", "name"])).toEqual([
      {
        field: "age",
        errors: [{ type: "external", message: "年龄无效", code: "external" }],
      },
      {
        field: "name",
        errors: [
          { type: "validation", message: "姓名错误" },
          { type: "external", message: "姓名已存在", code: "external" },
        ],
      },
    ])

    fieldStore.clearFieldsErrors(["name"])
    expect(fieldStore.getFieldErrors("name")).toEqual([])
    fieldStore.clearFieldsErrors(["age"])

    setTestRules(validator, "age", { invalid: true } as never)
    await validator.validate(baseValues)
    expect(fieldStore.getFieldErrors("age")).toEqual([
      {
        type: "configuration",
        message: "字段校验配置错误",
        code: "validation_config",
        cause: expect.any(Error),
      },
    ])
    validator.removeFieldRules("age")

    validator.removeField("name")
    validator.removeField("email")
    await expect(validator.validate(baseValues)).resolves.toMatchObject({
      valid: true,
      errors: [],
    })

    consoleWarn.mockRestore()
    consoleError.mockRestore()
  })

  it("等价字符串与数组路径共享同一字段身份", async () => {
    const fieldStore = createStore<{ profile: { email: string } }>()

    const validator = createTestValidator({ fieldStore })

    setTestRules(validator, "profile.email", [
      {
        validate: () => ({
          valid: false,
          issues: [{ type: "validation", message: "邮箱错误" }],
        }),
      },
    ])

    await expect(
      validator.validateField(["profile", "email"] as never, {
        profile: { email: "invalid" },
      })
    ).resolves.toMatchObject({
      valid: false,
      errors: [{ name: ["profile", "email"], issues: [{ message: "邮箱错误" }] }],
    })
    expect(fieldStore.getFieldErrors("profile.email")).toEqual([
      { type: "validation", message: "邮箱错误" },
    ])
  })

  it("规则与 external 错误均复制调用方输入，并隔离返回消息", async () => {
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    const rules: ValidationRule<string, TestForm, "name">[] = [failingRule("原始规则")]

    const messages = ["原始消息"]

    setTestRules(validator, "name", rules)
    fieldStore.setFieldErrors("name", [
      { type: "external", message: messages[0], code: "external" },
    ])

    rules.splice(0, 1, passingRule())
    messages[0] = "被调用方改写"
    const returnedErrors = fieldStore.getFieldErrors("name") as ValidationRuleIssue[]

    returnedErrors[0] = {
      type: "external",
      message: "被消费者改写",
      code: "external",
    }

    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      valid: false,
      errors: [
        {
          issues: [{ message: "原始规则" }, { message: "原始消息", code: "external" }],
        },
      ],
    })
    expect(fieldStore.getFieldErrors("name")).toEqual([
      { type: "validation", message: "原始规则" },
      { type: "external", message: "原始消息", code: "external" },
    ])
  })

  it("规则异常通过 onRuleError 转换", async () => {
    const error = new Error("boom")

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createTestValidator<TestForm>({
      onRuleError: (error) => `执行异常: ${(error as Error).message}`,
    })

    setTestRules(validator, "name", [throwingRule(error)])

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

    const validator = createTestValidator<TestForm>()

    setTestRules(validator, "name", [throwingRule(error)])

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

  it("onRuleError 抛错时使用稳定默认提示", async () => {
    const ruleError = new Error("规则错误")

    const handlerError = new Error("处理器错误")

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createTestValidator<TestForm>({
      onRuleError: () => {
        throw handlerError
      },
    })

    setTestRules(validator, "name", [throwingRule(ruleError)])

    try {
      await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
        valid: false,
        errors: [
          {
            issues: [
              {
                type: "validation",
                message: "校验执行失败",
                code: "rule_execution",
                cause: handlerError,
              },
            ],
          },
        ],
      })
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] 字段 "name" 校验规则错误处理器执行错误',
        handlerError
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("旧异步结果不能覆盖新状态", async () => {
    const first = deferred<ValidationRuleResult>()

    const second = deferred<ValidationRuleResult>()

    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    setTestRules(validator, "name", [sequencedRule(first.promise, second.promise)])

    const oldRun = validator.validateField("name", { ...baseValues, name: "old" })

    const newRun = validator.validateField("name", { ...baseValues, name: "new" })

    second.resolve({ valid: true })
    await newRun
    first.resolve({ valid: false, issues: [{ type: "validation", message: "旧错误" }] })
    await oldRun

    expect(fieldStore.getFieldErrors("name")).toEqual([])
  })

  it("替换规则会取消旧运行，并拒绝旧规则回写", async () => {
    const pending = deferred<ValidationRuleResult>()

    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    setTestRules(validator, "name", [{ validate: () => pending.promise }])

    const oldRun = validator.validateField("name", baseValues)

    await Promise.resolve()
    setTestRules(validator, "name", [failingRule("新规则错误")])
    pending.resolve({
      valid: false,
      issues: [{ type: "validation", message: "旧规则错误" }],
    })

    await expect(oldRun).resolves.toMatchObject({ cancelled: true, errors: [] })
    await expect(validator.validateField("name", baseValues)).resolves.toMatchObject({
      errors: [{ issues: [{ message: "新规则错误" }] }],
    })
    expect(fieldStore.getFieldErrors("name")).toEqual([
      { type: "validation", message: "新规则错误" },
    ])
  })

  it("移除字段配置会中止运行并清除该字段全部错误", async () => {
    const pending = deferred<ValidationRuleResult>()

    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    setTestRules(validator, "name", [{ validate: () => pending.promise }])
    fieldStore.setFieldErrors("name", [
      { type: "external", message: "服务端错误", code: "external" },
    ])

    const validation = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.removeField("name")
    pending.resolve({
      valid: false,
      issues: [{ type: "validation", message: "过期错误" }],
    })

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values: baseValues,
      errors: [],
    })
    expect(fieldStore.getFieldErrors("name")).toEqual([])
    await expect(validator.validate(baseValues)).resolves.toEqual({
      valid: true,
      values: baseValues,
      errors: [],
    })
  })

  it("FieldArray 截断会移除越界字段配置和错误", async () => {
    const values: ArrayForm = {
      users: [{ name: "Ada" }],
    }

    const fieldStore = createStore<ArrayForm>()

    const validator = createTestValidator<ArrayForm>({ fieldStore })

    const validate = vi.fn(() => ({
      valid: false as const,
      issues: [{ type: "validation" as const, message: "过期错误" }],
    }))

    setTestRules(validator, "users.1.name", [{ validate }])
    fieldStore.setFieldErrors("users.1.name", [
      { type: "external", message: "服务端错误", code: "external" },
    ])

    validator.invalidateFieldArray("users", {
      previousLength: 2,
      nextLength: 1,
      ranges: [{ start: 1, end: 1 }],
    })

    await expect(validator.validate(values)).resolves.toEqual({
      valid: true,
      values,
      errors: [],
    })
    expect(validate).not.toHaveBeenCalled()
    expect(fieldStore.getFieldErrors("users.1.name")).toEqual([])
  })

  it("FieldArray 受影响的在范围字段会中止运行但保留配置", async () => {
    const values: ArrayForm = {
      users: [{ name: "Ada" }],
    }

    const pending = deferred<ValidationRuleResult>()

    const validator = createTestValidator<ArrayForm>()

    let runs = 0

    setTestRules(validator, "users.0.name", [
      {
        validate: () => {
          runs += 1

          return runs === 1 ? pending.promise : { valid: true }
        },
      },
    ])

    const validation = validator.validateField("users.0.name", values)

    await Promise.resolve()
    validator.invalidateFieldArray("users", {
      previousLength: 1,
      nextLength: 1,
      ranges: [{ start: 0, end: 0 }],
    })
    pending.resolve({ valid: true })

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values,
      errors: [],
    })
    await expect(validator.validateField("users.0.name", values)).resolves.toEqual({
      valid: true,
      values,
      errors: [],
    })
    expect(runs).toBe(2)
  })

  it("external 错误会阻止全表校验通过，即使字段没有规则", async () => {
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    fieldStore.setFieldErrors("email", [
      { type: "external", message: "服务端已占用", code: "external" },
    ])

    await expect(validator.validate(baseValues)).resolves.toEqual({
      valid: false,
      values: baseValues,
      errors: [
        {
          scope: "field",
          name: "email",
          issues: [{ type: "external", message: "服务端已占用", code: "external" }],
        },
      ],
    })
  })

  it("非法空 issue 失败结果转换为规则执行错误", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const validator = createTestValidator<TestForm>()

    setTestRules(validator, "name", [
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
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    const signals: AbortSignal[] = []

    setTestRules(validator, "name", [captureSignalRule(signals)])
    void validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()
    validator.destroy()

    expect(signals[0].aborted).toBe(true)
    expect(fieldStore.getFieldErrors("name")).toEqual([])
  })

  it("规则因 abort 拒绝时不产生可见错误", async () => {
    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    const abortRule: ValidationRule<string, TestForm, "name"> = {
      validate: (_value, context) =>
        new Promise<ValidationRuleResult>((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          })
        }),
    }

    setTestRules(validator, "name", [abortRule])

    const validation = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values: baseValues,
      errors: [],
    })
    expect(fieldStore.getFieldErrors("name")).toEqual([])
  })

  it("destroy 后旧运行完成也不会回写错误", async () => {
    const result = deferred<ValidationRuleResult>()

    const fieldStore = createStore<TestForm>()

    const validator = createTestValidator<TestForm>({ fieldStore })

    setTestRules(validator, "name", [{ validate: () => result.promise }])

    const validation = validator.validateField("name", baseValues)

    await Promise.resolve()
    validator.destroy()
    result.resolve({
      valid: false,
      issues: [{ type: "validation", message: "过期错误" }],
    })

    await expect(validation).resolves.toEqual({
      valid: false,
      cancelled: true,
      values: baseValues,
      errors: [],
    })
    expect(fieldStore.getFieldErrors("name")).toEqual([])
  })

  it("失败规则聚合信息，bail 停止后续规则", async () => {
    const validator = createTestValidator<TestForm>()

    setTestRules(validator, "name", [
      failingRule("第一个错误"),
      {
        validate: () => ({
          valid: false,
          issues: [{ type: "validation", message: "必填错误" }],
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
          issues: [
            { type: "validation", message: "第一个错误" },
            { type: "validation", message: "必填错误" },
          ],
        },
      ],
    })
  })

  it("validate 顺序校验全部已配置字段", async () => {
    const validator = createTestValidator<TestForm>()

    setTestRules(validator, "name", [failingRule("姓名错误")])
    setTestRules(validator, "email", [
      {
        validate: () => ({
          valid: false,
          issues: [{ type: "validation", message: "邮箱错误" }],
        }),
      },
    ])

    await expect(validator.validate(baseValues)).resolves.toEqual({
      valid: false,
      values: baseValues,
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ type: "validation", message: "姓名错误" }],
        },
        {
          scope: "field",
          name: "email",
          issues: [{ type: "validation", message: "邮箱错误" }],
        },
      ],
    })
  })
})

describe("Validator 错误 signal 属性测试", () => {
  it("Property 11: Store 设置字段错误后可读取，清空后返回空数组", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        (path, errors) => {
          const fieldStore = createStore<Record<string, unknown>>()

          const issues = errors.map((message) => ({
            type: "external" as const,
            message,
          }))

          fieldStore.setFieldErrors(path, issues)
          expect(fieldStore.getFieldErrors(path)).toEqual(issues)

          fieldStore.clearAllErrors()
          expect(fieldStore.getFieldErrors(path)).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })
})
