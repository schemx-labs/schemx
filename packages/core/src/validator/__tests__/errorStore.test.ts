import { describe, expect, it } from "vitest"

import { FieldErrorStore } from "../errorStore"

import type { ValidationRuleIssue } from "../types"

interface TestForm {
  name: string
  age: number
  email: string
}

const createIssue = (message: string, code: string): ValidationRuleIssue => ({
  message,
  code,
})

describe("FieldErrorStore", () => {
  it("支持错误来源和字段的单数与复数操作", () => {
    const store = new FieldErrorStore<TestForm>()

    store.replaceFieldsValidation([
      { name: "name", issues: [createIssue("姓名错误", "validation")] },
      { name: "age", issues: [createIssue("年龄错误", "validation")] },
    ])
    store.replaceFieldsConfiguration([
      { name: "name", issues: [createIssue("姓名配置错误", "configuration")] },
    ])
    store.replaceFieldsExternal([{ name: "name", messages: ["姓名已存在"] }])

    expect(store.getFieldsIssues(["name", "email"])).toEqual([
      {
        name: "name",
        issues: [
          createIssue("姓名配置错误", "configuration"),
          createIssue("姓名错误", "validation"),
          { message: "姓名已存在", code: "external" },
        ],
      },
      { name: "email", issues: [] },
    ])
    expect(store.getFieldsMessages(["age", "name"])).toEqual([
      { name: "age", messages: ["年龄错误"] },
      { name: "name", messages: ["姓名配置错误", "姓名错误", "姓名已存在"] },
    ])

    store.clearFieldsValidation(["name"])
    expect(store.getMessages("name")).toEqual(["姓名配置错误", "姓名已存在"])

    store.clearFieldsConfiguration(["name"])
    expect(store.getMessages("name")).toEqual(["姓名已存在"])

    store.clearFields(["name", "age"])
    expect(store.entries()).toEqual([])
  })
})
