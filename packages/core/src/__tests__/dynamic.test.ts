import { describe, expect, it, vi } from "vitest"

import {
  createForm,
  isDynamicSchema,
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
  type SchemxDynamicField,
  type SchemxDynamicItemDependencyRendererContext,
  type SchemxDynamicItemSchema,
  type SchemxFormApi,
  type Values,
} from "../index"

interface FormValues {
  users: Array<{
    name: string
    age: number
  }>
}

interface DynamicDependencyFormValues {
  settings: {
    country: string
  }
  users: DynamicDependencyUser[]
}

interface DynamicDependencyUser {
  name: string
  idCard?: string
  passport?: string
}

interface DynamicPresentationFormValues {
  showUsers: boolean
  users: Array<{
    name: string
  }>
}

describe("Dynamic Schema", () => {
  it("按 FieldArray 行展开相对字段路径", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Ada", age: 36 },
          { name: "Grace", age: 28 },
        ],
      },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          item: [
            { name: "name", label: "姓名", componentType: "input" },
            { name: "age", label: "年龄", componentType: "inputNumber" },
          ],
        },
      ],
    })

    const view = form.getViewSchemas()[0]

    expect(view && isViewDynamicSchema(view)).toBe(true)

    if (!view || !isViewDynamicSchema(view)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(view).not.toHaveProperty("item")
    expect(view.items).toHaveLength(2)
    expect(
      view.items[0]?.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
    ).toEqual(["users.0.name", "users.0.age"])
    expect(
      view.items[1]?.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
    ).toEqual(["users.1.name", "users.1.age"])

    form.destroy()
  })

  it("数组结构变化后复用行 key 并更新字段索引", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Ada", age: 36 },
          { name: "Grace", age: 28 },
        ],
      },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    const initialView = form.getViewSchemas()[0]

    if (!initialView || !isViewDynamicSchema(initialView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    const firstRowKey = initialView.items[0]?.key

    form.setFieldValue("users", (users) => {
      const next = [...(users ?? [])]

      const moved = next.shift()

      if (moved) {
        next.push(moved)
      }

      return next
    })

    const view = form.getViewSchemas()[0]

    if (!view || !isViewDynamicSchema(view)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(view.items[1]?.key).toBe(firstRowKey)
    const movedField = view.items[1]?.children.find(isSchemxViewFieldSchema)

    expect(movedField?.name).toBe("users.1.name")

    form.destroy()
  })

  it("展开 Dynamic 行内的 Group 模板", () => {
    const form = createForm<FormValues>({
      initialValues: { users: [{ name: "Ada", age: 36 }] },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          item: [
            {
              label: "用户信息",
              children: [{ name: "name", label: "姓名", componentType: "input" }],
            },
          ],
        },
      ],
    })

    const view = form.getViewSchemas()[0]

    if (!view || !isViewDynamicSchema(view)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    const group = view.items[0]?.children[0]

    expect(group && isViewGroupSchema(group)).toBe(true)

    if (!group || !isViewGroupSchema(group)) {
      throw new Error("Dynamic Group ViewSchema 未生成")
    }

    const field = group.children[0]

    expect(field && isSchemxViewFieldSchema(field) && field.name).toBe("users.0.name")

    form.destroy()
  })

  it("重排行内 Group 时允许字段路径交换", () => {
    const form = createForm<FormValues>({
      initialValues: {
        users: [
          { name: "Ada", age: 36 },
          { name: "Grace", age: 28 },
        ],
      },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          item: [
            {
              key: "user-row",
              label: "用户信息",
              children: [{ name: "name", label: "姓名", componentType: "input" }],
            },
          ],
        },
      ],
    })

    const initialView = form.getViewSchemas()[0]

    if (!initialView || !isViewDynamicSchema(initialView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    const firstRowKey = initialView.items[0]?.key

    form.setFieldValue("users", (users) => {
      const next = [...(users ?? [])]

      const moved = next.shift()

      if (moved) {
        next.push(moved)
      }

      return next
    })

    const view = form.getViewSchemas()[0]

    if (!view || !isViewDynamicSchema(view)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(view.items[1]?.key).toBe(firstRowKey)

    const group = view.items[1]?.children[0]

    if (!group || !isViewGroupSchema(group)) {
      throw new Error("重排后的 Group ViewSchema 未生成")
    }

    const field = group.children[0]

    expect(field && isSchemxViewFieldSchema(field) && field.name).toBe("users.1.name")

    form.destroy()
  })

  it("允许 Dynamic 作为普通 Group 的子 Schema", () => {
    const form = createForm<FormValues>({
      initialValues: { users: [{ name: "Ada", age: 36 }] },
      schemas: [
        {
          label: "用户列表",
          children: [
            {
              key: "users-schema",
              name: "users",
              item: [{ name: "name", label: "姓名", componentType: "input" }],
            },
          ],
        },
      ],
    })

    const group = form.getViewSchemas()[0]

    if (!group || !isViewGroupSchema(group)) {
      throw new Error("外层 Group ViewSchema 未生成")
    }

    const dynamic = group.children[0]

    expect(dynamic && isViewDynamicSchema(dynamic)).toBe(true)

    if (!dynamic || !isViewDynamicSchema(dynamic)) {
      throw new Error("Group 内 Dynamic ViewSchema 未生成")
    }

    expect(dynamic.items[0]?.children).toHaveLength(1)

    form.destroy()
  })

  it("Dynamic dependencies 应控制容器状态并传播到行内字段", async () => {
    const form = createForm<DynamicPresentationFormValues>({
      debug: true,
      initialValues: {
        showUsers: true,
        users: [{ name: "Ada" }],
      },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          dependencies: {
            triggerFields: ["showUsers"],
            visible: (values) => values.showUsers,
            readonly: (values) => !values.showUsers,
            disabled: (values) => !values.showUsers,
          },
          item: [
            {
              name: "name",
              label: "姓名",
              componentType: "input",
            },
          ],
        },
      ],
    })

    await form.validate()

    const initialView = form.getViewSchemas()[0]

    if (!initialView || !isViewDynamicSchema(initialView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(initialView).not.toHaveProperty("dependencies")
    expect(initialView.debug?.hasDependencyEffect).toBe(true)
    expect(initialView).toMatchObject({
      visible: true,
      readonly: false,
      disabled: false,
    })
    expect(initialView.items[0]?.children[0]).toMatchObject({
      name: "users.0.name",
      visible: true,
      readonly: false,
      disabled: false,
    })

    form.setFieldValue("showUsers", false)
    await form.validate()

    const hiddenView = form.getViewSchemas()[0]

    if (!hiddenView || !isViewDynamicSchema(hiddenView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(hiddenView).toMatchObject({
      visible: false,
      readonly: true,
      disabled: true,
    })
    expect(hiddenView.items[0]?.children[0]).toMatchObject({
      name: "users.0.name",
      visible: false,
      readonly: true,
      disabled: true,
    })

    form.setFieldValue("showUsers", true)
    await form.validate()

    const restoredView = form.getViewSchemas()[0]

    if (!restoredView || !isViewDynamicSchema(restoredView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(restoredView.visible).toBe(true)
    expect(restoredView.items[0]?.children[0]).toMatchObject({
      visible: true,
      readonly: false,
      disabled: false,
    })

    form.destroy()
  })

  it("Dynamic 行内 Dependency 保留绝对 to 并按行展开 renderer 输出", async () => {
    const renderer = vi.fn(
      (
        values: DynamicDependencyFormValues,
        _form: SchemxFormApi<DynamicDependencyFormValues>,
        context: SchemxDynamicItemDependencyRendererContext<
          Values,
          DynamicDependencyFormValues
        >
      ) => {
        const fieldName: "idCard" | "passport" =
          values.settings.country === "CN" ? "idCard" : "passport"

        void context

        return [
          {
            name: fieldName,
            label: "证件号",
            componentType: "input",
          },
        ]
      }
    )

    const dynamicSchema: SchemxDynamicField<DynamicDependencyFormValues> = {
      key: "users-schema",
      name: "users",
      item: [
        {
          key: "country-dependent",
          to: ["settings.country"],
          dependencies: {
            triggerFields: ["settings.country"],
            readonly: (values: Values) => values.settings.country === "US",
          },
          renderer,
        },
      ],
    }

    const form = createForm<DynamicDependencyFormValues>({
      initialValues: {
        settings: { country: "CN" },
        users: [{ name: "Ada" }, { name: "Grace" }],
      },
      schemas: [dynamicSchema],
    })

    await form.validate()

    const initialView = form.getViewSchemas()[0]

    if (!initialView || !isViewDynamicSchema(initialView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(renderer).toHaveBeenCalledTimes(2)
    expect(
      initialView.items.map((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
      )
    ).toEqual([["users.0.idCard"], ["users.1.idCard"]])
    expect(renderer.mock.calls.map(([, , context]) => context.item.name)).toEqual([
      "Ada",
      "Grace",
    ])

    form.setFieldValue("settings.country", "US")
    await form.validate()

    expect(renderer).toHaveBeenCalledTimes(4)

    const afterCountryChange = form.getViewSchemas()[0]

    if (!afterCountryChange || !isViewDynamicSchema(afterCountryChange)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(
      afterCountryChange.items.map((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
      )
    ).toEqual([["users.0.passport"], ["users.1.passport"]])
    expect(
      afterCountryChange.items.map((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.readonly)
      )
    ).toEqual([[true], [true]])

    form.setFieldValue("users", (users) => {
      const next = [...(users ?? [])]

      const moved = next.pop()

      if (moved) {
        next.unshift(moved)
      }

      return next
    })
    await form.validate()

    expect(renderer).toHaveBeenCalledTimes(6)
    expect(
      renderer.mock.calls.slice(-2).map(([, , context]) => ({
        item: context.item.name,
        rowIndex: context.rowIndex,
        rowPath: context.rowPath,
      }))
    ).toEqual([
      { item: "Grace", rowIndex: 0, rowPath: "users.0" },
      { item: "Ada", rowIndex: 1, rowPath: "users.1" },
    ])

    const afterMove = form.getViewSchemas()[0]

    if (!afterMove || !isViewDynamicSchema(afterMove)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(
      afterMove.items.map((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
      )
    ).toEqual([["users.0.passport"], ["users.1.passport"]])

    form.setFieldValue("users", (users) => [...(users ?? []), { name: "Lin" }])
    await form.validate()

    expect(renderer).toHaveBeenCalledTimes(7)

    const afterAppend = form.getViewSchemas()[0]

    if (!afterAppend || !isViewDynamicSchema(afterAppend)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(
      afterAppend.items.map((item) =>
        item.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
      )
    ).toEqual([["users.0.passport"], ["users.1.passport"], ["users.2.passport"]])

    form.destroy()
  })

  it("Dynamic 行内 Dependency 的过期异步 renderer 不会覆盖最新结果", async () => {
    let resolveSlowRenderer:
      | ((
          schemas: SchemxDynamicItemSchema<Values, DynamicDependencyFormValues>[]
        ) => void)
      | undefined

    const renderer = vi.fn(
      (
        values: DynamicDependencyFormValues,
        _form: SchemxFormApi<DynamicDependencyFormValues>,
        context: SchemxDynamicItemDependencyRendererContext<
          Values,
          DynamicDependencyFormValues
        >
      ) => {
        void context

        if (values.settings.country === "slow") {
          return new Promise<
            SchemxDynamicItemSchema<Values, DynamicDependencyFormValues>[]
          >((resolve) => {
            resolveSlowRenderer = resolve
          })
        }

        return [{ name: "current", label: "当前值", componentType: "input" }]
      }
    )

    const form = createForm<DynamicDependencyFormValues>({
      initialValues: {
        settings: { country: "CN" },
        users: [{ name: "Ada" }],
      },
      schemas: [
        {
          key: "users-schema",
          name: "users",
          item: [
            {
              key: "country-dependent",
              to: ["settings.country"],
              renderer,
            },
          ],
        },
      ],
    })

    await form.validate()

    form.setFieldValue("settings.country", "slow")
    await Promise.resolve()
    await Promise.resolve()

    form.setFieldValue("settings.country", "latest")
    await form.validate()

    if (!resolveSlowRenderer) {
      throw new Error("slow renderer 未启动")
    }

    resolveSlowRenderer([{ name: "stale", label: "过期值", componentType: "input" }])
    await Promise.resolve()
    await form.validate()

    const view = form.getViewSchemas()[0]

    if (!view || !isViewDynamicSchema(view)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(
      view.items[0]?.children.filter(isSchemxViewFieldSchema).map((field) => field.name)
    ).toEqual(["users.0.current"])

    form.destroy()
  })

  it("拒绝 Dynamic 模板中的嵌套 Dynamic", () => {
    expect(() =>
      createForm<FormValues>({
        initialValues: { users: [] },
        schemas: [
          {
            key: "users-schema",
            name: "users",
            item: [
              {
                key: "nested-dynamic",
                name: "users",
                item: [],
              },
            ],
          } as never,
        ],
      })
    ).toThrow("只能包含 Field、Group 或 Dependency Schema")
  })

  it("通过 key、name、item 识别 Dynamic Schema", () => {
    expect(
      isDynamicSchema({
        key: "users-schema",
        name: "users",
        item: [],
      } as never)
    ).toBe(true)

    expect(
      isDynamicSchema({
        label: "用户",
        children: [],
      } as never)
    ).toBe(false)
  })
})
