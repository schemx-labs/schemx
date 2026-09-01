import { describe, expect, it } from "vitest"

import {
  createRequiredValidationRule,
  createStandardSchemaValidationRule,
} from "../built-in.rules"

import type { StandardSchemaV1 } from "../../types/standardSchema"
import type { ValidationRuleContext } from "../types"

/**
 * 创建最小规则执行上下文。
 */
const createContext = (): ValidationRuleContext => ({
  name: "field",
  values: {},
  signal: new AbortController().signal,
})

/**
 * 创建最小 Standard Schema 测试对象。
 *
 * @param validate - 测试用的 Schema 校验函数。
 */
const createSchema = (
  validate: StandardSchemaV1["~standard"]["validate"]
): StandardSchemaV1 => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate,
  },
})

describe("规则归一化", () => {
  it.each([undefined, null, "", []])("默认 required 拒绝空值 %#", async (value) => {
    const rule = createRequiredValidationRule({ required: true, label: "用户名" })

    const result = await rule.validate(value, createContext())

    expect(result).toEqual({
      valid: false,
      issues: [{ type: "validation", message: "用户名为必填项", code: "required" }],
      bail: true,
    })
  })

  it.each([0, false, "value", [1]])("默认 required 接受非空值 %#", async (value) => {
    const rule = createRequiredValidationRule({ required: true, label: "字段" })

    expect(await rule.validate(value, createContext())).toEqual({ valid: true })
  })

  it("自定义 isEmpty 完整替换默认判断", async () => {
    const rule = createRequiredValidationRule<string>({
      required: { message: "请选择有效值", isEmpty: (value) => value === "N/A" },
      label: "值",
    })

    expect(await rule.validate("N/A", createContext())).toMatchObject({
      valid: false,
    })
    expect(await rule.validate("", createContext())).toEqual({ valid: true })
  })

  it("Standard Schema wrapper 只映射 issues，不返回转换值", async () => {
    const schema = createSchema(() => ({ value: 123 }))

    const rule = createStandardSchemaValidationRule(schema)

    await expect(rule.validate("123", createContext())).resolves.toEqual({ valid: true })
  })

  it("Standard Schema wrapper 仅保留 issue 消息", async () => {
    const schema = createSchema(() => ({
      issues: [{ message: "格式错误", path: ["field"] }],
    }))

    const rule = createStandardSchemaValidationRule(schema)

    await expect(rule.validate("invalid", createContext())).resolves.toEqual({
      valid: false,
      issues: [{ type: "validation", message: "格式错误" }],
    })
  })
})
