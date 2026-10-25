import { describe, expect, it, vi } from "vite-plus/test"

import { createField } from "../createField"
import { createForm } from "../createForm"
import {
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
} from "../runtime/view"

import type { SchemxFieldInstance } from "../createField"
import type { SchemxViewFieldSchema, SchemxViewSchema } from "../runtime/view"
import type { Values as CoreValues, SchemxField, SchemxInstance } from "../types"
import type { ValidationRuleResult } from "../validator"

interface RowValues {
  users: Array<{ name: string }>
}

/**
 * 创建带有三个稳定行对象的 Dynamic 表单。
 */
function createRowsForm() {
  return createForm<RowValues>({
    initialValues: { users: [{ name: "Ada" }, { name: "Grace" }, { name: "Lin" }] },
    schemas: [
      {
        key: "users",
        name: "users",
        item: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            required: true,
            validationTrigger: "change",
          },
        ],
      },
    ],
  })
}

/**
 * 收集行内字段，透明 Dependency 已由视图展开。
 * @param schemas - 当前行或分组的子视图。
 */
function collectFields(
  schemas: readonly SchemxViewSchema<RowValues>[]
): SchemxViewFieldSchema<RowValues>[] {
  return schemas.flatMap((schema) =>
    isViewGroupSchema(schema)
      ? collectFields(schema.children)
      : isSchemxViewFieldSchema(schema)
        ? [schema]
        : []
  )
}

/**
 * 从 Dynamic 视图取得字段节点控制器。
 * @param form - 当前动态表单。
 */
function getRows(form: SchemxInstance<RowValues>) {
  const view = form.getViewSchemas()[0]

  if (!view || !isViewDynamicSchema(view)) throw new Error("缺少 Dynamic 视图")

  return view.items
    .flatMap((row) => collectFields(row.children))
    .map((field) => {
      return form.createField(field.name)
    })
}

/**
 * 取得测试中已挂载的顶层字段，否则立即失败。
 * @typeParam TValues - 表单值类型。
 * @param form - 当前测试表单。
 * @param index - 顶层字段的位置。
 */
function requireNode<TValues extends CoreValues>(
  form: SchemxInstance<TValues>,
  index = 0
): SchemxFieldInstance<TValues> {
  const view = form.getViewSchemas()[index]

  if (!view || !isSchemxViewFieldSchema(view)) throw new Error("缺少字段节点")

  return form.createField(view.name)
}

/**
 * 取得测试中已生成的数组行字段，否则立即失败。
 * @param form - 当前动态表单。
 * @param index - 数组行的位置。
 */
function requireRow(
  form: SchemxInstance<RowValues>,
  index = 0
): SchemxFieldInstance<RowValues> {
  const field = getRows(form)[index]

  if (!field) throw new Error("缺少行字段节点")

  return field
}

describe("Core 字段节点控制器", () => {
  it("首次按路径定位已挂载节点，相同节点复用控制器及状态", () => {
    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [
        {
          label: "分组",
          children: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    const group = form.getViewSchemas()[0]

    if (!group || !isViewGroupSchema(group)) throw new Error("缺少分组")

    const view = group.children[0]

    if (!view || !isSchemxViewFieldSchema(view)) throw new Error("缺少字段")

    const field = createField(form, view.name)

    expect(createField(form, "name")).toBe(field)
    expect(createField(form, "name").state).toBe(field.state)
    expect(field.state.name.value).toBe("name")
    expect(field.state.value.value).toBe("Ada")
    expect("getFieldNode" in form).toBe(false)
    form.destroy()
  })

  it("节点入口复用 Core 交互编排，程序赋值与用户修改保持区分", async () => {
    const onChange = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [
        { name: "name", label: "姓名", componentType: "input", required: true, onChange },
      ],
    })

    const field = requireNode(form)

    field.setValue("programmatic")
    expect(field.state.touched.value).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    await expect(field.change("")).resolves.toBeUndefined()
    expect(field.state.touched.value).toBe(true)
    expect(onChange).toHaveBeenCalledExactlyOnceWith("", form)
    await expect(field.blur()).resolves.toMatchObject({ valid: false })
    expect(field.state.errors.value).toEqual(["姓名为必填项"])
    form.destroy()
  })

  it("同 key 改名保留控制器，状态和操作切换到新路径，Form 路径状态保持原绑定", async () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "field", name: "name", label: "姓名", componentType: "input" }],
    })

    const field = requireNode(form)

    const state = field.state

    const pathField = form.state.field("name")

    const seen: unknown[] = []

    form.effect(() => seen.push([state.name.value, state.value.value]))
    form.setFieldErrors("nickname", ["昵称错误"])
    form.setFieldTouched("nickname", true)
    form.setFieldPending("nickname", true)
    form.setSchemas([
      { key: "field", name: "nickname", label: "昵称", componentType: "input" },
    ])
    expect(createField(form, "nickname")).toBe(field)
    expect(field.state).toBe(state)
    expect(seen).toEqual([
      ["name", "Ada"],
      ["nickname", "A"],
    ])
    expect(state.errors.value).toEqual(["昵称错误"])
    expect(state.touched.value).toBe(true)
    expect(state.pending.value).toBe(true)
    field.setValue("next")
    expect(form.getFieldValue("nickname")).toBe("next")
    expect(pathField.value.value).toBe("Ada")
    form.clearFieldErrors("nickname")
    await expect(field.validate()).resolves.toMatchObject({
      valid: true,
      values: { name: "Ada", nickname: "next" },
    })
    form.destroy()
  })

  it("Schema 重排和消费配置更新保留节点及控制器", () => {
    const form = createForm({
      initialValues: { first: "A", second: "B" },
      schemas: [
        { key: "first", name: "first", label: "一", componentType: "input" },
        { key: "second", name: "second", label: "二", componentType: "input" },
      ],
    })

    const first = requireNode(form)

    form.updateSchemas((schemas) => [...schemas].reverse())
    form.setConfig({ schemaConfig: { readonly: true } })
    expect(requireNode(form, 1)).toBe(first)
    expect(first.state.name.value).toBe("first")
    expect(first.state.value.value).toBe("A")
    expect(first.state.disposed.value).toBe(false)
    form.destroy()
  })

  it("Schema 交换路径后节点保留身份，观察者只读取完整的新关联", () => {
    const form = createForm({
      initialValues: { first: "A", second: "B" },
      schemas: [
        { key: "a", name: "first", label: "一", componentType: "input" },
        { key: "b", name: "second", label: "二", componentType: "input" },
      ],
    })

    const first = requireNode(form)

    const second = requireNode(form, 1)

    const seen: unknown[] = []

    form.effect(() =>
      seen.push([
        first.state.name.value,
        first.state.value.value,
        second.state.name.value,
        second.state.value.value,
      ])
    )
    form.setSchemas([
      { key: "a", name: "second", label: "一", componentType: "input" },
      { key: "b", name: "first", label: "二", componentType: "input" },
    ])
    expect(requireNode(form)).toBe(first)
    expect(requireNode(form, 1)).toBe(second)
    expect(seen).toEqual([
      ["first", "A", "second", "B"],
      ["second", "B", "first", "A"],
    ])
    form.destroy()
  })

  it.each([true, false])(
    "卸载永久失效并释放订阅，保留值策略独立于控制器生命周期：preserve=%s",
    async (preserve) => {
      const schema = {
        key: "field",
        name: "name" as const,
        label: "姓名",
        componentType: "input",
        preserve,
      }

      const form = createForm({ initialValues: { name: "Ada" }, schemas: [schema] })

      const field = requireNode(form)

      const values = vi.fn()

      const names = vi.fn()

      const disposed = vi.fn()

      field.state.value.subscribe(values)
      field.state.name.subscribe(names)
      field.state.disposed.subscribe(disposed)
      form.setFieldTouched("name", true)
      form.setFieldPending("name", true)
      form.setFieldErrors("name", ["旧错误"])
      form.setSchemas([])
      expect(field.state.disposed.value).toBe(true)
      expect(field.state.name.value).toBeUndefined()
      expect(field.state.value.value).toBeUndefined()
      expect(field.state.errors.value).toEqual([])
      expect(field.state.touched.value).toBe(false)
      expect(field.state.pending.value).toBe(false)
      expect(values.mock.calls.map(([value]) => value)).toEqual(["Ada", undefined])
      expect(names.mock.calls.map(([value]) => value)).toEqual(["name", undefined])
      expect(disposed.mock.calls.map(([value]) => value)).toEqual([false, true])
      expect(form.getFieldValue("name")).toBe(preserve ? "Ada" : undefined)
      form.setSchemas([schema])
      const replacement = requireNode(form)

      expect(replacement).not.toBe(field)
      replacement.setValue("replacement")
      field.setValue("stale")
      await expect(field.change("stale")).resolves.toBeUndefined()
      await expect(field.blur()).resolves.toBeUndefined()
      await expect(field.validate()).resolves.toMatchObject({
        cancelled: true,
        errors: [],
      })
      expect(form.getFieldValue("name")).toBe("replacement")
      expect(values).toHaveBeenCalledTimes(2)
      const late = vi.fn()

      field.state.value.subscribe(late)
      expect(late).not.toHaveBeenCalled()
      form.destroy()
    }
  )

  it("卸载生命周期回调执行前，旧节点控制器已经失效", () => {
    const unmounted = vi.fn(() => {
      expect(field?.state.disposed.value).toBe(true)
      expect(field?.state.name.value).toBeUndefined()
      field?.setValue("stale")
    })

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
      lifecycleHooks: { unmounted },
    })

    const field = requireNode(form)

    form.setSchemas([])
    expect(unmounted).toHaveBeenCalledTimes(1)
    expect(form.getFieldValue("name")).toBe("Ada")
    form.destroy()
  })

  it("Dynamic 重排后节点跟随原行，订阅不观察中间路径或其他行的值", async () => {
    const form = createRowsForm()

    const [first, second] = getRows(form)

    if (!first || !second) throw new Error("缺少数组行")

    const pathField = form.state.field("users.0.name")

    const seen: unknown[] = []

    const values = vi.fn()

    first.state.value.subscribe(values)
    form.effect(() =>
      seen.push([
        first.state.name.value,
        first.state.value.value,
        second.state.name.value,
        second.state.value.value,
      ])
    )
    form.setFieldValue("users", (users) => [
      ...(users ?? []).slice(1),
      ...(users ?? []).slice(0, 1),
    ])
    expect(getRows(form)[2]).toBe(first)
    expect(getRows(form)[0]).toBe(second)
    expect(first.state.name.value).toBe("users.2.name")
    expect(first.state.value.value).toBe("Ada")
    expect(pathField.value.value).toBe("Grace")
    expect(seen).toEqual([
      ["users.0.name", "Ada", "users.1.name", "Grace"],
      ["users.2.name", "Ada", "users.0.name", "Grace"],
    ])
    expect(values.mock.calls.map(([value]) => value)).toEqual(["Ada"])
    await expect(first.change("Ada updated")).resolves.toMatchObject({ valid: true })
    expect(form.getFieldValue("users.2.name")).toBe("Ada updated")
    expect(form.getFieldValue("users.0.name")).toBe("Grace")
    form.destroy()
  })

  it("同一批次中先重排再写节点，写入仍属于原行且消费者只收到最终状态", () => {
    const form = createRowsForm()

    const first = requireRow(form)

    const listener = vi.fn()

    first.state.value.subscribe(listener)
    form.batch(() => {
      form.setFieldValue("users", (users) => [
        ...(users ?? []).slice(1),
        ...(users ?? []).slice(0, 1),
      ])
      first.setValue("updated")
    })
    expect(form.getFieldValue("users.2.name")).toBe("updated")
    expect(form.getFieldValue("users.0.name")).toBe("Grace")
    expect(listener.mock.calls.map(([value]) => value)).toEqual(["Ada", "updated"])
    form.destroy()
  })

  it.each([
    { preserve: true, structure: "field" },
    { preserve: false, structure: "field" },
    { preserve: false, structure: "group" },
    { preserve: false, structure: "dependency" },
  ])(
    "Dynamic 异步输出 $structure 在 renderer 刷新前同步跟随原行：preserve=$preserve",
    async ({ preserve, structure }) => {
      let release: (() => void) | undefined

      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      let pause = false

      const form = createForm<RowValues>({
        initialValues: { users: [{ name: "Ada" }, { name: "Grace" }, { name: "Lin" }] },
        schemas: [
          {
            key: "users",
            name: "users",
            item: [
              {
                key: "generated",
                to: ["users"],
                renderer: async () => {
                  if (pause) await gate
                  const field = {
                    key: "name",
                    name: "name" as const,
                    label: "姓名",
                    componentType: "input",
                    preserve,
                  }

                  if (structure === "group")
                    return [{ key: "group", label: "分组", children: [field] }]
                  if (structure === "dependency")
                    return [
                      { key: "nested", to: ["users" as const], renderer: () => [field] },
                    ]

                  return [field]
                },
              },
            ],
          },
        ],
      })

      try {
        await form.waitForDependencies()
        const first = requireRow(form)

        const listener = vi.fn()

        first.state.value.subscribe(listener)
        pause = true
        form.setFieldValue("users", (users) => [
          ...(users ?? []).slice(1),
          ...(users ?? []).slice(0, 1),
        ])
        expect(first.state.name.value).toBe("users.2.name")
        expect(first.state.value.value).toBe("Ada")
        expect(listener.mock.calls.map(([value]) => value)).toEqual(["Ada"])
        first.setValue("updated")
        expect(form.getFieldValue("users.2.name")).toBe("updated")
        expect(form.getFieldValue("users.0.name")).toBe("Grace")
        release?.()
        await form.waitForDependencies()
        expect(getRows(form)[2]).toBe(first)
      } finally {
        release?.()
        form.destroy()
      }
    }
  )

  it.each(["remove", "replace", "reset"] as const)(
    "Dynamic %s 后旧节点不能操作占用同一索引的新行",
    async (action) => {
      const form = createRowsForm()

      const first = requireRow(form)

      if (action === "remove")
        form.setFieldValue("users", (users) => (users ?? []).slice(1))
      if (action === "replace")
        form.setFieldValue("users", (users) => [
          { name: "new" },
          ...(users ?? []).slice(1),
        ])
      if (action === "reset") form.reset()
      const replacement = requireRow(form)

      expect(replacement).not.toBe(first)
      expect(first.state.disposed.value).toBe(true)
      const value = replacement.state.value.value

      first.setValue("stale")
      await expect(first.change("stale")).resolves.toBeUndefined()
      expect(replacement.state.value.value).toBe(value)
      expect(first.state.value.value).toBeUndefined()
      form.destroy()
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
        const field = requireNode(form)

        form.setFieldValue("busy", true)
        await vi.waitFor(() => expect(waiting).toBe(true))
        const validation = field.validate()

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
        if (action === "rename") {
          expect(field.state.name.value).toBe("nickname")
          expect(field.state.disposed.value).toBe(false)
        }
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

    const field = requireNode(form)

    const validation = field.validate()

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
    await expect(field.change("")).resolves.toMatchObject({
      valid: false,
      errors: [{ name: "nickname" }],
    })
    finish?.({ valid: false, issues: [{ message: "旧错误" }] })
    await oldRule
    expect(form.getFieldErrors("name")).toEqual([])
    expect(field.state.errors.value).toEqual(["昵称为必填项"])
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

    const field = requireNode(form)

    await expect(field.change("updated")).resolves.toMatchObject({ cancelled: true })
    expect(validate).not.toHaveBeenCalled()
    expect(field.state.name.value).toBe("nickname")
    expect(field.state.value.value).toBe("A")
    expect(form.getFieldValue("name")).toBe("updated")
    form.destroy()
  })

  it("Form 销毁同时结束节点控制器，已取得状态仍可安全读取", async () => {
    const form = createRowsForm()

    const field = requireRow(form)

    const listener = vi.fn()

    field.state.value.subscribe(listener)
    form.destroy()
    expect(field.state.disposed.peek()).toBe(true)
    expect(field.state.value.peek()).toBeUndefined()
    expect(field.state.errors.peek()).toEqual([])
    expect(listener.mock.calls.map(([value]) => value)).toEqual(["Ada", undefined])
    field.setValue("late")
    await expect(field.validate()).resolves.toMatchObject({ cancelled: true })
    await expect(field.change("late")).resolves.toBeUndefined()
  })
})
