import { configureSchemx, createForm } from "@schemx/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAsyncValidatorAdapter } from "../async-validator"

const asyncValidator = createAsyncValidatorAdapter()

beforeEach(() => {
  // 重置全局校验配置，确保集成只依赖下面每个 form 显式传入的 validatorAdapters。
  configureSchemx({})
})

describe("@schemx/validator × core 集成", () => {
  it("裸 async-validator descriptor 经 createForm 校验失败", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      validatorAdapters: [asyncValidator],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ type: "email", message: "async 邮箱格式错误" }],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [
        { scope: "field", name: "email", issues: [{ message: "async 邮箱格式错误" }] },
      ],
    })
    form.destroy()
  })

  it("async-validator 必填 descriptor 经 createForm 校验失败", async () => {
    const form = createForm({
      initialValues: { email: "" },
      validatorAdapters: [asyncValidator],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ required: true, message: "必填" }],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ scope: "field", name: "email", issues: [{ message: "必填" }] }],
    })
    form.destroy()
  })

  it("合法值通过校验", async () => {
    const form = createForm({
      initialValues: { email: "a@b.com" },
      validatorAdapters: [asyncValidator],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ type: "email", message: "邮箱格式错误" }],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({ valid: true })
    form.destroy()
  })

  it("submit 返回校验结果并在成功时回调 onFinish", async () => {
    const onFinish = vi.fn()

    const form = createForm({
      initialValues: { email: "a@b.com" },
      validatorAdapters: [asyncValidator],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [{ type: "email", message: "邮箱格式错误" }],
        },
      ],
      onFinish,
    })

    await expect(form.submit()).resolves.toMatchObject({ valid: true })
    expect(onFinish).toHaveBeenCalled()
    form.destroy()
  })
})
