import { describe, expect, it, vi } from "vite-plus/test"

import { createForm } from "../createForm"
import { createFormStateAdapter, getFormAdapter } from "../index"
import * as core from "../index"

import type { SchemxField } from "../types"
import type { ValidationRuleResult } from "../validator"

describe("Core 路径操作与过期任务保护", () => {
  it("公开入口不再提供字段引用或字段控制器", () => {
    // 无 Schema 的路径也直接由 Form 操作。
    const form = createForm({ initialValues: { name: "Ada" } })

    expect(core).not.toHaveProperty("createField")
    expect(form).not.toHaveProperty("getFieldRef")
    expect(form).not.toHaveProperty("getFieldName")
    expect(form).not.toHaveProperty("getFieldState")
    form.setFieldValue("name", "Grace")
    expect(form.getFieldValue("name")).toBe("Grace")
    form.destroy()
  })

  it("数组重排后同一路径观察新占用者，批次内写入仍使用传入位置", async () => {
    // 行身份用于内部协调，两个公开 adapter 均只观察固定位置。
    const form = createForm({
      initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
      schemas: [
        {
          key: "users",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input", required: true }],
        },
      ],
    })

    // 原生路径状态在数组重排后复用。
    const native = getFormAdapter(form).field("users.0.name")

    // 快照来源使用相同的路径语义。
    const adapter = createFormStateAdapter(form)

    const snapshot = adapter.field("users.0.name")

    // 普通 getter 继续收集当前位置的依赖，批次只交付最终值。
    const seen = vi.fn(() => form.getFieldValue("users.0.name"))

    form.effect(seen)
    form.batch(() => {
      form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
      form.setFieldValue("users.0.name", "Updated")
    })
    expect(getFormAdapter(form).field("users.0.name")).toBe(native)
    expect(adapter.field("users.0.name")).toBe(snapshot)
    expect(native.value.peek()).toBe("Updated")
    expect(snapshot.value.getSnapshot()).toBe("Updated")
    expect(form.getFieldValue("users.1.name")).toBe("Ada")
    expect(seen.mock.results.map((result) => result.value)).toEqual(["Ada", "Updated"])
    await expect(form.changeField("users.0.name", "")).resolves.toBeUndefined()
    await expect(form.blurField("users.0.name")).resolves.toMatchObject({ valid: false })
    expect(native.errors.peek()).toEqual(["姓名为必填项"])
    expect(form.getFieldErrors("users.1.name")).toEqual([])
    adapter.dispose()
    form.destroy()
  })

  it("Schema 改名与同址替换不改变路径状态目标，消费端显式选择新路径", () => {
    // 保留值以单独验证路径状态与 Schema 生命周期的边界。
    const form = createForm({
      initialValues: { name: "Ada", alias: "Grace" },
      schemas: [{ key: "field", name: "name", label: "姓名", componentType: "input" }],
    })

    const adapter = getFormAdapter(form)

    const fixed = adapter.field("name")

    form.setSchemas([
      { key: "field", name: "alias", label: "别名", componentType: "input" },
    ])
    expect(adapter.field("name")).toBe(fixed)
    expect(fixed.value.peek()).toBe("Ada")
    expect(adapter.field("alias").value.peek()).toBe("Grace")
    form.setFieldTouched("name", true)
    form.setFieldPending("name", true)
    form.setFieldErrors("name", ["external"])
    form.setSchemas([])
    form.setSchemas([
      { key: "replacement", name: "name", label: "替换", componentType: "input" },
    ])
    form.setFieldValue("name", "Replacement")
    expect(adapter.field("name")).toBe(fixed)
    expect(fixed.value.peek()).toBe("Replacement")
    expect(fixed.touched.peek()).toBe(true)
    expect(fixed.pending.peek()).toBe(true)
    expect(fixed.errors.peek()).toEqual(["external"])
    expect(form.getFieldValue("alias")).toBe("Grace")
    form.destroy()
  })

  it.each(["move", "remove", "replace", "reset"] as const)(
    "数组 %s 取消已开始的交互，旧错误不写入新占用者",
    async (action) => {
      // action 决定路径变更方式，旧规则在变更后才交付结果。
      let finish: (result: ValidationRuleResult) => void = () => {}

      const pending = new Promise<ValidationRuleResult>((resolve) => {
        // resolve 用于显式交付过期校验结果。
        finish = resolve
      })

      const validate = vi.fn(() => pending)

      const form = createForm({
        initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
        schemas: [
          {
            key: "users",
            name: "users",
            item: [
              {
                name: "name",
                label: "姓名",
                componentType: "input",
                validationTrigger: "change",
                rules: { validate },
              },
            ],
          },
        ],
      })

      try {
        const result = form.changeField("users.0.name", "Edited")

        await vi.waitFor(() => expect(validate).toHaveBeenCalledTimes(1))
        if (action === "move") {
          form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
        } else if (action === "remove") {
          form.setFieldValue("users", (users) => (users ?? []).slice(1))
        } else if (action === "replace") {
          form.setFieldValue("users", (users) => [
            { name: "New" },
            ...(users ?? []).slice(1),
          ])
        } else {
          form.reset()
        }

        await expect(result).resolves.toMatchObject({ cancelled: true })

        // 当前索引已属于其他节点，旧操作不能覆盖该节点的值或错误。
        form.setFieldValue("users.0.name", "Replacement")
        finish({ valid: false, issues: [{ message: "旧错误" }] })
        await pending
        expect(form.getFieldValue("users.0.name")).toBe("Replacement")
        expect(form.getFieldErrors("users.0.name")).toEqual([])
        expect(form.getFieldErrors("users.1.name")).toEqual([])
      } finally {
        finish({ valid: true })
        form.destroy()
      }
    }
  )

  it.each(["rename", "remove"] as const)(
    "依赖等待期间 %s 节点会立即取消旧校验",
    async (action) => {
      let release: (() => void) | undefined

      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      const validate = vi.fn((): ValidationRuleResult => ({ valid: true }))

      let waiting = false

      interface Values {
        name: string
        nickname: string
        busy: boolean
      }

      const busy: SchemxField<Values> = {
        name: "busy",
        label: "忙碌",
        componentType: "input",
        dependencies: {
          triggerFields: ["busy"],
          trigger: async (values) => {
            if (values.busy) {
              waiting = true
              await gate
            }
          },
        },
      }

      const form = createForm<Values>({
        initialValues: { name: "Ada", nickname: "A", busy: false },
        schemas: [
          {
            key: "field",
            name: "name",
            label: "姓名",
            componentType: "input",
            rules: { validate },
          },
          busy,
        ],
      })

      try {
        await form.waitForDependencies()
        form.setFieldValue("busy", true)
        await vi.waitFor(() => expect(waiting).toBe(true))
        const validation = form.validateField("name")

        form.setSchemas(
          action === "remove"
            ? [busy]
            : [
                {
                  key: "field",
                  name: "nickname",
                  label: "昵称",
                  componentType: "input",
                  required: true,
                },
                busy,
              ]
        )
        await expect(validation).resolves.toMatchObject({ cancelled: true, errors: [] })
        expect(validate).not.toHaveBeenCalled()
      } finally {
        release?.()
        form.destroy()
      }
    }
  )

  it("路径变化中止执行中的异步规则，新校验使用新路径，旧结果不会重新写入", async () => {
    let finish: ((result: ValidationRuleResult) => void) | undefined

    const oldRule = new Promise<ValidationRuleResult>((resolve) => {
      finish = resolve
    })

    let signal: AbortSignal | undefined

    const validate = vi.fn((_value, context) => {
      signal = context.signal

      return oldRule
    })

    const form = createForm({
      initialValues: { name: "Ada", nickname: "" },
      schemas: [
        {
          key: "field",
          name: "name",
          label: "姓名",
          componentType: "input",
          rules: { validate },
        },
      ],
    })

    const validation = form.validateField("name")

    await vi.waitFor(() => expect(validate).toHaveBeenCalledTimes(1))
    form.setSchemas([
      {
        key: "field",
        name: "nickname",
        label: "昵称",
        componentType: "input",
        required: true,
        validationTrigger: "change",
      },
    ])
    expect(signal?.aborted).toBe(true)
    await expect(validation).resolves.toMatchObject({ cancelled: true })
    await expect(form.changeField("nickname", "")).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "nickname" }],
    })
    finish?.({ valid: false, issues: [{ message: "旧错误" }] })
    await oldRule
    expect(form.getFieldErrors("name")).toEqual([])
    expect(form.getFieldErrors("nickname")).toEqual(["昵称为必填项"])
    form.destroy()
  })

  it("业务回调改变节点路径后，本次交互不会校验占据旧路径的其他字段", async () => {
    const validate = vi.fn((): ValidationRuleResult => ({ valid: true }))

    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [
        {
          key: "field",
          name: "name",
          label: "姓名",
          componentType: "input",
          validationTrigger: "change",
          rules: { validate },
          onChange: (_value, current) =>
            current.setSchemas([
              { key: "field", name: "nickname", label: "昵称", componentType: "input" },
              {
                key: "replacement",
                name: "name",
                label: "替换",
                componentType: "input",
                rules: { validate },
              },
            ]),
        },
      ],
    })

    await expect(form.changeField("name", "updated")).resolves.toMatchObject({
      cancelled: true,
    })
    expect(validate).not.toHaveBeenCalled()
    expect(form.getFieldValue("nickname")).toBe("A")
    expect(form.getFieldValue("name")).toBe("updated")
    form.destroy()
  })
})
