import { describe, expect, it, vi } from "vite-plus/test"

import { createField } from "../createField"
import { createForm } from "../createForm"
import { createSchemx } from "../createSchemx"

import type { ValidationTrigger } from "../types"
import type { ValidationRuleResult } from "../validator"

describe("Core 字段交互", () => {
  it("程序赋值保持原语义，用户修改同步提交值与 touched，默认失焦才校验", async () => {
    const onChange = vi.fn()

    const onBlur = vi.fn()

    const form = createForm({
      initialValues: { name: "initial" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
          onChange,
          onBlur,
        },
      ],
    })

    const field = createField(form, "name")

    field.setValue("programmatic")
    form.setFieldsValue({ name: "another" })
    expect(field.isTouched()).toBe(false)
    expect(field.getErrors()).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
    expect(onBlur).not.toHaveBeenCalled()

    const observed: unknown[] = []

    form.effect(() => observed.push([field.state.value.value, field.state.touched.value]))
    const change = field.change("")

    expect(field.getValue()).toBe("")
    expect(field.isTouched()).toBe(true)
    expect(observed).toEqual([
      ["another", false],
      ["", true],
    ])
    expect(onChange).toHaveBeenCalledExactlyOnceWith("", form)
    await expect(change).resolves.toBeUndefined()
    expect(field.getErrors()).toEqual([])
    await expect(field.blur()).resolves.toMatchObject({ valid: false })
    expect(onBlur).toHaveBeenCalledExactlyOnceWith(form)
    expect(field.getErrors()).toEqual(["姓名为必填项"])
    form.destroy()
  })

  it("只发生失焦也标记 touched，显式 validate 不受自动触发策略限制", async () => {
    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
          validationTrigger: "submit",
        },
      ],
    })

    const field = createField(form, "name")

    await expect(field.blur()).resolves.toBeUndefined()
    expect(field.isTouched()).toBe(true)
    expect(field.getValue()).toBe("")
    await expect(field.validate()).resolves.toMatchObject({ valid: false })
    await expect(form.submit()).resolves.toMatchObject({ valid: false })
    form.destroy()
  })

  it.each<{
    trigger: ValidationTrigger | ValidationTrigger[]
    change: boolean
    blur: boolean
  }>([
    { trigger: "change", change: true, blur: false },
    { trigger: "onChange", change: true, blur: false },
    { trigger: "blur", change: false, blur: true },
    { trigger: "onBlur", change: false, blur: true },
    { trigger: ["onChange", "blur"], change: true, blur: true },
    { trigger: "submit", change: false, blur: false },
    { trigger: "onSubmit", change: false, blur: false },
    { trigger: [], change: false, blur: false },
  ])("直接匹配生效触发配置 $trigger", async ({ trigger, change, blur }) => {
    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
          validationTrigger: trigger,
        },
      ],
    })

    const changed = await form.changeField("name", "")

    expect(changed?.valid).toBe(change ? false : undefined)
    form.clearErrors()
    const blurred = await form.blurField("name")

    expect(blurred?.valid).toBe(blur ? false : undefined)
    form.destroy()
  })

  it("同一字段控制器始终使用最新消费配置，字段覆盖优先于表单默认值", async () => {
    const api = createSchemx({ schemaConfig: { validationTrigger: "change" } })

    const form = api.createForm({
      initialValues: { name: "", fixed: "" },
      schemas: [
        { name: "name", label: "姓名", componentType: "input", required: true },
        {
          name: "fixed",
          label: "固定",
          componentType: "input",
          required: true,
          validationTrigger: "submit",
        },
      ],
    })

    const field = createField(form, "name")

    await expect(field.change("")).resolves.toMatchObject({ valid: false })
    await expect(form.changeField("fixed", "")).resolves.toBeUndefined()
    form.setConfig({ schemaConfig: { validationTrigger: "onBlur" } })
    await expect(field.change("")).resolves.toBeUndefined()
    await expect(field.blur()).resolves.toMatchObject({ valid: false })
    form.setConfig({})
    await expect(field.change("")).resolves.toMatchObject({ valid: false })
    form.updateSchemas((schemas) =>
      schemas.map((schema) => ({ ...schema, validationTrigger: "submit" }))
    )
    await expect(field.change("")).resolves.toBeUndefined()
    form.destroy()
  })

  it.each([{ visible: false }, { readonly: true }, { disabled: true }])(
    "不可操作字段忽略用户交互，但允许程序赋值：%j",
    async (state) => {
      const onChange = vi.fn()

      const onBlur = vi.fn()

      const form = createForm({
        initialValues: { name: "initial" },
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            required: true,
            validationTrigger: ["change", "blur"],
            onChange,
            onBlur,
            ...state,
          },
        ],
      })

      await expect(form.changeField("name", "ignored")).resolves.toBeUndefined()
      await expect(form.blurField("name")).resolves.toBeUndefined()
      expect(form.getFieldValue("name")).toBe("initial")
      expect(form.isFieldTouched("name")).toBe(false)
      expect(onChange).not.toHaveBeenCalled()
      expect(onBlur).not.toHaveBeenCalled()
      form.setFieldValue("name", "programmatic")
      expect(form.getFieldValue("name")).toBe("programmatic")
      expect(form.isFieldTouched("name")).toBe(false)
      form.destroy()
    }
  )

  it("父容器限制参与交互判定，子字段不能自行解除禁用", async () => {
    const form = createForm({
      initialValues: { name: "initial" },
      schemas: [
        {
          label: "分组",
          disabled: true,
          children: [
            { name: "name", label: "姓名", componentType: "input", disabled: false },
          ],
        },
      ],
    })

    await expect(form.changeField("name", "ignored")).resolves.toBeUndefined()
    expect(form.getFieldValue("name")).toBe("initial")
    expect(form.isFieldTouched("name")).toBe(false)
    form.destroy()
  })

  it("无 Schema 的手动字段使用 Core 表单配置与手动规则", async () => {
    const form = createForm({ initialValues: { name: "" } })

    const field = createField(form, "name")

    field.setRules({ required: true, message: "不能为空" })
    await expect(field.change("")).resolves.toBeUndefined()
    await expect(field.blur()).resolves.toMatchObject({ valid: false })
    form.setConfig({ schemaConfig: { validationTrigger: "change" } })
    await expect(field.change("Ada")).resolves.toMatchObject({ valid: true })
    form.setConfig({ schemaConfig: { disabled: true } })
    await expect(field.change("ignored")).resolves.toBeUndefined()
    expect(field.getValue()).toBe("Ada")
    form.destroy()
  })

  it("业务回调读取已提交状态，回调中的程序赋值不产生交互回路", async () => {
    const seen: unknown[] = []

    const componentChange = vi.fn()

    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
          validationTrigger: "change",
          componentProps: { onChange: componentChange },
          onChange: (value, current) => {
            seen.push([
              value,
              current.getFieldValue("name"),
              current.isFieldTouched("name"),
            ])
            current.setFieldValue("name", value?.trim())
          },
        },
      ],
    })

    await expect(form.changeField("name", "  Ada  ")).resolves.toMatchObject({
      valid: true,
      values: { name: "Ada" },
    })
    expect(seen).toEqual([["  Ada  ", "  Ada  ", true]])
    expect(componentChange).not.toHaveBeenCalled()
    await expect(form.changeField("name", undefined)).resolves.toMatchObject({
      valid: false,
    })
    expect(seen[1]).toEqual([undefined, undefined, true])
    form.destroy()
  })

  it("回调重置表单后不再启动本次交互的校验", async () => {
    const validate = vi.fn((): ValidationRuleResult => ({ valid: true }))

    const form = createForm({
      initialValues: { name: "initial" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          validationTrigger: "change",
          rules: { validate },
          onChange: (_value, current) => current.reset(),
        },
      ],
    })

    await expect(form.changeField("name", "new")).resolves.toMatchObject({
      cancelled: true,
    })
    expect(form.getFieldValue("name")).toBe("initial")
    expect(form.isFieldTouched("name")).toBe(false)
    expect(validate).not.toHaveBeenCalled()
    form.destroy()
  })

  it.each(["disabled", "trigger"] as const)(
    "依赖等待结束后重新检查最新 %s",
    async (mode) => {
      let release: (() => void) | undefined

      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      const validate = vi.fn((): ValidationRuleResult => ({ valid: true }))

      let waiting = false

      const form = createForm({
        initialValues: { name: "initial" },
        schemaConfig: { validationTrigger: "change" },
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            rules: { validate },
            dependencies: {
              triggerFields: ["name"],
              disabled: async (values) => {
                if (values.name !== "wait") return false
                waiting = true
                await gate

                return mode === "disabled"
              },
            },
          },
        ],
      })

      await form.waitForDependencies()
      const change = form.changeField("name", "wait")

      await vi.waitFor(() => expect(waiting).toBe(true))
      if (mode === "trigger")
        form.setConfig({ schemaConfig: { validationTrigger: "submit" } })
      release?.()
      await expect(change).resolves.toBeUndefined()
      expect(validate).not.toHaveBeenCalled()
      form.destroy()
    }
  )

  it("未配置 change 校验时不等待异步依赖，校验由后续失焦触发", async () => {
    let release: (() => void) | undefined

    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    let waiting = false

    const form = createForm({
      initialValues: { name: "initial" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
          dependencies: {
            triggerFields: ["name"],
            required: async (values) => {
              if (values.name !== "") return true
              waiting = true
              await gate

              return true
            },
          },
        },
      ],
    })

    await form.waitForDependencies()
    await expect(form.changeField("name", "")).resolves.toBeUndefined()
    await vi.waitFor(() => expect(waiting).toBe(true))
    const blur = form.blurField("name")

    release?.()
    await expect(blur).resolves.toMatchObject({ valid: false })
    form.destroy()
  })

  it.each(["reset", "destroy"] as const)(
    "依赖等待期间 %s 会取消交互校验",
    async (action) => {
      let release: (() => void) | undefined

      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      const validate = vi.fn((): ValidationRuleResult => ({ valid: true }))

      let waiting = false

      const form = createForm({
        initialValues: { name: "initial" },
        schemas: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            validationTrigger: "change",
            rules: { validate },
            dependencies: {
              triggerFields: ["name"],
              required: async (values) => {
                if (values.name !== "wait") return false
                waiting = true
                await gate

                return true
              },
            },
          },
        ],
      })

      await form.waitForDependencies()
      const change = form.changeField("name", "wait")

      await vi.waitFor(() => expect(waiting).toBe(true))
      form[action]()
      await expect(change).resolves.toMatchObject({ cancelled: true, errors: [] })
      release?.()
      await form.waitForDependencies()
      expect(validate).not.toHaveBeenCalled()
      if (action === "destroy") {
        await expect(form.changeField("name", "late")).resolves.toBeUndefined()
        await expect(form.blurField("name")).resolves.toBeUndefined()
      }

      form.destroy()
    }
  )

  it("连续交互复用 Validator 的取消机制，旧异步错误不会覆盖新结果", async () => {
    let finishOld: ((result: ValidationRuleResult) => void) | undefined

    const oldRule = new Promise<ValidationRuleResult>((resolve) => {
      finishOld = resolve
    })

    const validate = vi.fn((value) =>
      value === "old" ? oldRule : { valid: true as const }
    )

    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          validationTrigger: "change",
          rules: { validate },
        },
      ],
    })

    const field = createField(form, "name")

    const old = field.change("old")

    await vi.waitFor(() => expect(validate).toHaveBeenCalledTimes(1))
    await expect(field.change("new")).resolves.toMatchObject({ valid: true })
    await expect(old).resolves.toMatchObject({ cancelled: true, errors: [] })
    finishOld?.({ valid: false, issues: [{ message: "旧错误" }] })
    await oldRule
    expect(field.getValue()).toBe("new")
    expect(field.getErrors()).toEqual([])
    form.destroy()
  })
})
