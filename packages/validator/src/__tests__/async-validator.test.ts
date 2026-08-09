import { describe, expect, test } from "vitest"

import {
  type AsyncValidatorDescriptor,
  createAsyncValidatorAdapter,
} from "../async-validator"

import type { NamePath, ValidationRuleContext, Values } from "@schemx/core"

const createContext = <TValues extends Values, TName extends NamePath<TValues>>(
  values: TValues,
  name: TName,
  signal = new AbortController().signal
): ValidationRuleContext<TValues, TName> => ({ name, values, signal })

/**
 * 解析规则并执行返回的原生规则，等价于此前直接调用 adapter.validate。
 *
 * resolve 接收构建期 FieldValidationConfig（仅用 name），返回的规则 validate
 * 接收运行期 ValidationRuleContext（含 values 与 signal）。
 */
async function run(
  adapter: ReturnType<typeof createAsyncValidatorAdapter>,
  input: AsyncValidatorDescriptor,
  value: unknown,
  ctx: ValidationRuleContext
) {
  const rules = adapter.resolve(input, {
    name: ctx.name,
    label: "",
  })

  return rules[0].validate(value, ctx)
}

describe("createAsyncValidatorAdapter", () => {
  test("仅识别合法的 async-validator descriptor", () => {
    const adapter = createAsyncValidatorAdapter()

    expect(adapter.isRule({ required: true })).toBe(true)
    expect(adapter.isRule([{ required: true }, { type: "email" }])).toBe(true)
    expect(adapter.isRule([])).toBe(true)
    expect(adapter.isRule(null)).toBe(false)
    expect(adapter.isRule("required")).toBe(false)
    expect(adapter.isRule([{ required: true }, null])).toBe(false)
  })

  test("可直接校验裸 descriptor", async () => {
    const adapter = createAsyncValidatorAdapter()

    await expect(
      run(adapter, { required: true }, "", createContext({ email: "" }, "email"))
    ).resolves.toMatchObject({ valid: false, issues: [{ message: "email is required" }] })
  })

  test("成功时返回有效结果", async () => {
    const adapter = createAsyncValidatorAdapter()

    await expect(
      run(
        adapter,
        { type: "email", message: "邮箱格式错误" },
        "a@example.com",
        createContext({ email: "a@example.com" }, "email")
      )
    ).resolves.toEqual({ valid: true })
  })

  test("按原顺序映射单条和多条 async-validator 错误，并保留原始错误 cause", async () => {
    const adapter = createAsyncValidatorAdapter()

    const single = await run(
      adapter,
      { required: true, message: "请输入邮箱" },
      "",
      createContext({ email: "" }, "email")
    )

    const multiple = await run(
      adapter,
      [
        { min: 3, message: "至少三个字符" },
        { pattern: /^[A-Z]+$/, message: "必须全为大写" },
      ],
      "a",
      createContext({ code: "a" }, "code")
    )

    expect(single).toMatchObject({
      valid: false,
      issues: [{ message: "请输入邮箱", code: "email" }],
    })
    expect(single.valid ? undefined : single.issues[0]?.cause).toMatchObject({
      message: "请输入邮箱",
      field: "email",
    })
    expect(multiple).toMatchObject({
      valid: false,
      issues: [
        { message: "至少三个字符", code: "code" },
        { message: "必须全为大写", code: "code" },
      ],
    })
  })

  test("异步 custom validator 接收完整 values 上下文", async () => {
    const adapter = createAsyncValidatorAdapter()

    const sources: unknown[] = []

    const descriptor = {
      asyncValidator(_rule, value, _callback, source) {
        sources.push(source)

        return Promise.resolve(
          value === source.confirm
            ? undefined
            : Promise.reject(new Error("两次输入不一致"))
        )
      },
    } satisfies AsyncValidatorDescriptor

    await expect(
      run(
        adapter,
        descriptor,
        "secret",
        createContext({ password: "secret", confirm: "secret" }, "password")
      )
    ).resolves.toEqual({ valid: true })
    await expect(
      run(
        adapter,
        descriptor,
        "secret",
        createContext({ password: "secret", confirm: "other" }, "password")
      )
    ).resolves.toMatchObject({
      valid: false,
      issues: [{ message: "两次输入不一致", code: "password" }],
    })
    expect(sources).toEqual([
      { password: "secret", confirm: "secret" },
      { password: "secret", confirm: "other" },
    ])
  })

  test("嵌套对象字段使用 descriptor.fields 校验当前字段值", async () => {
    const adapter = createAsyncValidatorAdapter()

    const descriptor = {
      type: "object",
      fields: { email: { type: "email", message: "嵌套邮箱格式错误" } },
    } satisfies AsyncValidatorDescriptor

    await expect(
      run(
        adapter,
        descriptor,
        { email: "invalid" },
        createContext({ profile: { email: "invalid" }, locale: "zh-CN" }, "profile")
      )
    ).resolves.toMatchObject({
      valid: false,
      issues: [{ message: "嵌套邮箱格式错误", code: "profile.email" }],
    })
  })

  test("在执行前或异步执行期间中止时不返回陈旧错误", async () => {
    const adapter = createAsyncValidatorAdapter()

    const before = new AbortController()

    before.abort()
    const asyncDescriptor = {
      asyncValidator: () =>
        new Promise<void>((resolve, reject) =>
          setTimeout(() => reject(new Error("过期错误")), 10)
        ),
    }

    const during = new AbortController()

    const pending = run(
      adapter,
      asyncDescriptor,
      "value",
      createContext({ name: "value" }, "name", during.signal)
    )

    during.abort()

    await expect(
      run(
        adapter,
        { required: true, message: "必填" },
        "",
        createContext({ name: "" }, "name", before.signal)
      )
    ).resolves.toEqual({ valid: true })
    await expect(pending).resolves.toEqual({ valid: true })
  })
})
