import { describe, expect, it } from "vitest"

import { createForm } from "../../createForm"

import type { ValidationAdapter } from "../types"

describe("Core 内置 async-validator", () => {
  it("无需注册 adapter 即可校验 descriptor", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ type: "email", message: "邮箱格式错误" }],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "email", issues: [{ message: "邮箱格式错误" }] }],
    })

    form.destroy()
  })

  it("支持嵌套字段和多条 descriptor 规则", async () => {
    const form = createForm({
      initialValues: { profile: { email: "invalid" } },
      schemas: [
        {
          name: "profile",
          label: "个人资料",
          componentType: "group",
          rules: [
            {
              type: "object",
              fields: {
                email: { type: "email", message: "嵌套邮箱格式错误" },
              },
            },
            { required: true, message: "个人资料不能为空" },
          ],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "profile", issues: [{ message: "嵌套邮箱格式错误" }] }],
    })

    form.destroy()
  })

  it("向自定义 validator 提供完整表单值", async () => {
    const sources: unknown[] = []

    const form = createForm({
      initialValues: { password: "secret", confirm: "other" },
      schemas: [
        {
          name: "password",
          label: "密码",
          componentType: "input",
          rules: [
            {
              asyncValidator(_rule, value, _callback, source) {
                sources.push(source)

                return value === source.confirm
                  ? undefined
                  : Promise.reject(new Error("两次输入不一致"))
              },
            },
          ],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "password", issues: [{ message: "两次输入不一致" }] }],
    })
    expect(sources).toEqual([{ password: "secret", confirm: "other" }])

    form.destroy()
  })

  it("显式用户 adapter 优先于内置 async-validator", async () => {
    const adapter: ValidationAdapter = {
      id: "custom",
      isRule: (value) => typeof value === "object" && value !== null && "type" in value,
      resolve: () => [
        {
          validate: () => ({
            valid: false as const,
            issues: [{ type: "validation" as const, message: "自定义规则优先" }],
          }),
        },
      ],
    }

    const form = createForm({
      initialValues: { email: "valid@example.com" },
      validatorAdapters: [adapter],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ type: "email" }],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "email", issues: [{ message: "自定义规则优先" }] }],
    })

    form.destroy()
  })
})
