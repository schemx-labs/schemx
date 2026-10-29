import { describe, expect, it, vi } from "vite-plus/test"

import { createField, createForm } from "../index"
import * as nodeHelpers from "../node/helper"

import type { ValidationRuleResult, Values } from "../index"

describe("Form FieldRef", () => {
  it("字段引用和交互通过 Registry 定位，不再遍历节点树", async () => {
    // 禁止旧查询入口，覆盖引用创建和校验、交互的首次定位。
    const find = vi.spyOn(nodeHelpers, "findFieldNode").mockImplementation(() => {
      throw new Error("字段入口不应遍历节点树")
    })

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [
        {
          label: "分组",
          children: [
            {
              key: "name",
              name: "name",
              label: "姓名",
              componentType: "input",
              required: true,
            },
          ],
        },
      ],
    })

    try {
      const field = createField(form, "name")

      expect(form.getFieldRef("name")).toBe(field.ref)
      await expect(field.validate()).resolves.toMatchObject({ valid: true })
      await field.change("Grace")
      await expect(field.blur()).resolves.toMatchObject({ valid: true })
      expect(field.getValue()).toBe("Grace")
      expect(find).not.toHaveBeenCalled()
    } finally {
      find.mockRestore()
      form.destroy()
    }
  })

  it("引用只表示身份，直接通过 Form 操作并跟随节点移动", () => {
    const form = createForm({
      initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
      schemas: [
        {
          key: "users",
          label: "用户",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    const field = createField(form, "users.0.name")

    const ref = field.ref

    const state = form.getFieldState(ref)

    expect(Object.keys(ref)).toEqual([])
    expect("state" in ref).toBe(false)
    expect("setValue" in ref).toBe(false)
    expect("createField" in form).toBe(false)
    expect(form.getFieldRef("users.0.name")).toBe(ref)
    form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
    expect(form.getFieldName(ref)).toBe("users.1.name")
    expect(form.getFieldRef("users.1.name")).toBe(ref)
    expect(form.getFieldState(ref)).toBe(state)
    field.setValue("Updated")
    expect(field.getValue()).toBe("Updated")
    expect(form.getFieldValue("users.0.name")).toBe("Grace")
    expect(form.getFieldValue("users.1.name")).toBe("Updated")
    form.destroy()
  })

  it("字段工具跟随当前路径，Form 批量 API 仍只处理路径", () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "person", name: "name", label: "姓名", componentType: "input" }],
    })

    const field = createField(form, "name")

    const values: unknown[] = []

    const paths: unknown[] = []

    const snapshots = vi.fn(() => field.getSnapshot())

    form.effect(() => values.push(field.getValue()))
    form.effect(() => paths.push(form.getFieldsValue(["name"])))
    form.effect(snapshots)
    form.setSchemas([
      { key: "person", name: "nickname", label: "昵称", componentType: "input" },
    ])
    field.setTouched(true)
    field.setPending(true, "saving")
    field.setErrors(["external"])
    expect(form.isFieldsTouched(["nickname"])).toBe(true)
    expect(form.isFieldsPending(["nickname"])).toBe(true)
    expect(form.getFieldsSnapshot(["nickname"])).toEqual({ nickname: "A" })
    expect(form.getInitialValues(["nickname"])).toEqual({ nickname: "A" })
    expect(form.getFieldsErrors(["nickname"])[0]?.name).toBe("nickname")
    form.setSchemas([])
    expect(values).toEqual(["Ada", "A", undefined])
    expect(paths).toEqual([{ name: "Ada" }])
    expect(snapshots).toHaveBeenCalledTimes(1)
    form.destroy()
  })

  it("失效引用不接管同路径的新节点，写入忽略且校验取消", async () => {
    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ key: "old", name: "name", label: "姓名", componentType: "input" }],
    })

    const field = createField(form, "name")

    const ref = field.ref

    const state = form.getFieldState(ref)

    const seen = vi.fn(() => field.getValue())

    field.effect(seen)
    form.setSchemas([])
    form.setSchemas([{ key: "new", name: "name", label: "姓名", componentType: "input" }])
    const replacement = form.getFieldRef("name")

    expect(replacement).not.toBe(ref)
    field.setValue("stale")
    field.setInitialValue("stale")
    field.setErrors(["stale"])
    field.setTouched(true)
    field.setPending(true)
    field.setRules({ required: true })
    expect(form.getFieldValue("name")).toBe("Ada")
    expect(form.getFieldName(ref)).toBeUndefined()
    expect(field.getValue()).toBeUndefined()
    expect(field.getInitialValue()).toBeUndefined()
    expect(field.getSnapshot()).toBeUndefined()
    expect(field.getErrors()).toEqual([])
    expect(state.disposed.peek()).toBe(true)
    expect(state.value.peek()).toBeUndefined()
    expect(state.errors.peek()).toEqual([])
    expect(field.isTouched()).toBe(false)
    expect(field.isPending()).toBe(false)
    await expect(field.validate()).resolves.toMatchObject({ cancelled: true })
    await expect(field.change("stale")).resolves.toBeUndefined()
    expect(seen).toHaveBeenCalledTimes(1)
    form.destroy()
  })

  it("拒绝其他 Form 的引用，手动引用在 Form 销毁后失效", () => {
    const first = createForm({ initialValues: { name: "Ada" } })

    const second = createForm({ initialValues: { name: "Grace" } })

    const field = createField(first, "name")

    const ref = field.ref

    expect(() => second.getFieldState(ref)).toThrow("different Form")
    expect(() => second.getFieldName(ref)).toThrow("different Form")
    first.destroy()
    expect(first.getFieldName(ref)).toBeUndefined()
    expect(first.getFieldState(ref).disposed.peek()).toBe(true)
    expect(field.getValue()).toBeUndefined()
    expect(() => first.getFieldRef("name")).toThrow("destroyed")
    second.destroy()
  })

  it("手动引用保持初始路径，不随后来挂载的 Schema 字段改名或失效", () => {
    const form = createForm({ initialValues: { name: "Manual", nickname: "Alias" } })

    const manual = createField(form, "name")

    try {
      form.setSchemas([
        { key: "field", name: "name", label: "姓名", componentType: "input" },
      ])

      // 新 Schema 绑定节点，之前的手动引用继续绑定路径。
      const field = createField(form, "name")

      expect(field.ref).not.toBe(manual.ref)
      form.setSchemas([
        { key: "field", name: "nickname", label: "昵称", componentType: "input" },
      ])
      expect(form.getFieldName(manual.ref)).toBe("name")
      expect(form.getFieldName(field.ref)).toBe("nickname")
      expect(manual.getValue()).toBe("Manual")
      expect(field.getValue()).toBe("Alias")
      form.setSchemas([])
      expect(field.state.disposed.value).toBe(true)
      expect(manual.state.disposed.value).toBe(false)
      manual.setValue("Updated")
      expect(form.getFieldValue("name")).toBe("Updated")
    } finally {
      form.destroy()
    }

    expect(manual.state.disposed.value).toBe(true)
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

      const field = createField(form, "users.0.name")

      try {
        const result = field.change("Edited")

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
        const replacement = createField(form, "users.0.name")

        expect(replacement.ref).not.toBe(field.ref)
        replacement.setValue("Replacement")
        finish({ valid: false, issues: [{ message: "旧错误" }] })
        await pending
        expect(form.getFieldValue("users.0.name")).toBe("Replacement")
        expect(form.getFieldErrors("users.0.name")).toEqual([])
        expect(form.getFieldErrors("users.1.name")).toEqual([])
        if (action === "move") {
          expect(form.getFieldName(field.ref)).toBe("users.1.name")
          expect(field.getValue()).toBe("Edited")
        } else {
          expect(form.getFieldName(field.ref)).toBeUndefined()
          expect(field.state.disposed.value).toBe(true)
        }
      } finally {
        finish({ valid: true })
        form.destroy()
      }
    }
  )

  it("写入与快照读取不建立依赖，兼容工具正确保存函数值", () => {
    const initial = () => "initial"

    const next = vi.fn(() => "next")

    const form = createForm<Values>({ initialValues: { handler: initial } })

    const field = createField(form, "handler")

    const writer = vi.fn(() => field.setTouched(true))

    const snapshot = vi.fn(() => field.getSnapshot())

    form.effect(writer)
    form.effect(snapshot)
    field.setValue(next)
    field.setInitialValue(next)
    expect(field.getValue()).toBe(next)
    expect(field.getInitialValue()).toBe(next)
    expect(next).not.toHaveBeenCalled()
    expect(writer).toHaveBeenCalledTimes(1)
    expect(snapshot).toHaveBeenCalledTimes(1)
    form.destroy()
  })
})
