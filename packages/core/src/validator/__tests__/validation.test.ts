import { describe, expect, it } from "vitest"

import { createValidation } from "../validation"

/**
 * 测试用的表单值结构。
 */
interface FormValues {
  email: string
}

describe("createValidation", () => {
  it("聚合字段同步、规则注册与校验执行", async () => {
    const validation = createValidation<FormValues>()

    validation.registerRule("email", {
      validate: (value) =>
        value.includes("@")
          ? { valid: true }
          : { valid: false, issues: [{ message: "邮箱格式不正确", code: "email" }] },
    })
    validation.syncSchemaField({
      name: "email",
      label: "邮箱",
      required: true,
      rules: "email",
    })

    await expect(validation.validateField("email", { email: "invalid" })).resolves.toMatchObject({
      valid: false,
      errors: [{ issues: [{ code: "email" }] }],
    })

    validation.destroy()
  })

  it("Schema 卸载后保留运行时覆盖，并在覆盖删除后移除字段规则", async () => {
    const validation = createValidation<FormValues>()

    validation.syncSchemaField({
      name: "email",
      label: "邮箱",
      required: true,
      rules: undefined,
    })
    validation.setFieldRules({
      name: "email",
      label: "运行时邮箱",
      required: undefined,
      rules: {
        validate: () => ({ valid: false, issues: [{ message: "覆盖规则" }] }),
      },
    })
    validation.removeSchemaField("email")

    await expect(validation.validateField("email", { email: "" })).resolves.toMatchObject({
      valid: false,
      errors: [{ issues: [{ message: "覆盖规则" }] }],
    })

    validation.removeFieldRules("email")
    await expect(validation.validateField("email", { email: "" })).resolves.toMatchObject({
      valid: true,
    })

    validation.destroy()
  })
})
