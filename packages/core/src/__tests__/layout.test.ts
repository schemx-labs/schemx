import { describe, expect, it } from "vitest"

import {
  createForm,
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
  type SchemxField,
} from "../index"

interface TestCol {
  span?: number
  offset?: number
  block?: boolean
}

interface TestRow {
  gutter?: number
  justify?: string
  align?: string
}

declare module "../types/field" {
  interface SchemxFieldDefinition {
    col?: TestCol
    layout?: TestCol
    layoutFieldMeta?: string
  }
}

declare module "../types/group" {
  interface SchemxGroupFieldDefinition {
    row?: TestRow
    layout?: TestCol
    layoutGroupMeta?: string
  }
}

declare module "../types/dynamic" {
  interface SchemxDynamicDefinition {
    row?: TestRow
    layout?: TestCol
    layoutDynamicMeta?: string
  }
}

interface FormValues {
  title: string
  groupTitle: string
  users: Array<{
    name: string
    email: string
  }>
}

describe("Schema layout metadata", () => {
  it("保留 Field、Group、Dynamic 及动态数组子节点的 layout 和扩展属性", () => {
    const fieldLayout = { span: 12, offset: 1, block: true }

    const groupLayout = { span: 24 }

    const dynamicLayout = { span: 24 }

    const itemFieldLayout = { span: 8 }

    const itemGroupLayout = { span: 16, offset: 8 }

    const itemChildLayout = { span: 12 }

    const schemas: SchemxField<FormValues>[] = [
      {
        name: "title",
        label: "标题",
        componentType: "input",
        layout: fieldLayout,
        layoutFieldMeta: "field",
      },
      {
        label: "用户信息",
        layout: groupLayout,
        layoutGroupMeta: "group",
        children: [
          {
            name: "groupTitle",
            label: "分组标题",
            componentType: "input",
            layout: { span: 6 },
          },
        ],
      },
      {
        key: "users-schema",
        name: "users",
        layout: dynamicLayout,
        layoutDynamicMeta: "dynamic",
        item: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            layout: itemFieldLayout,
            layoutFieldMeta: "dynamic-item-field",
          },
          {
            label: "联系方式",
            layout: itemGroupLayout,
            layoutGroupMeta: "dynamic-item-group",
            children: [
              {
                name: "email",
                label: "邮箱",
                componentType: "input",
                layout: itemChildLayout,
                layoutFieldMeta: "dynamic-item-child",
              },
            ],
          },
        ],
      },
    ]

    const form = createForm<FormValues>({
      initialValues: {
        title: "表单",
        groupTitle: "分组标题",
        users: [{ name: "Ada", email: "ada@example.com" }],
      },
      schemas,
    })

    const views = form.getViewSchemas()

    const fieldView = views.find(
      (schema) => isSchemxViewFieldSchema(schema) && schema.name === "title"
    )

    const groupView = views.find(
      (schema) => isViewGroupSchema(schema) && schema.layoutGroupMeta === "group"
    )

    const dynamicView = views.find(
      (schema) => isViewDynamicSchema(schema) && schema.layoutDynamicMeta === "dynamic"
    )

    expect(fieldView).toMatchObject({
      layout: fieldLayout,
      layoutFieldMeta: "field",
    })
    expect(fieldView && isSchemxViewFieldSchema(fieldView)).toBe(true)

    if (!fieldView || !isSchemxViewFieldSchema(fieldView)) {
      throw new Error("Field ViewSchema 未生成")
    }

    expect(fieldView.layout).toBe(fieldLayout)
    expect(fieldView.componentProps?.formItemProps?.layout).toBe(fieldLayout)

    expect(groupView).toMatchObject({
      layout: groupLayout,
      layoutGroupMeta: "group",
    })

    if (!groupView || !isViewGroupSchema(groupView)) {
      throw new Error("Group ViewSchema 未生成")
    }

    expect(groupView.layout).toBe(groupLayout)
    expect(groupView.children[0]).toMatchObject({ layout: { span: 6 } })

    expect(dynamicView).toMatchObject({
      layout: dynamicLayout,
      layoutDynamicMeta: "dynamic",
    })

    if (!dynamicView || !isViewDynamicSchema(dynamicView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(dynamicView.layout).toBe(dynamicLayout)

    const itemFieldView = dynamicView.items[0]?.children.find(
      (schema) =>
        isSchemxViewFieldSchema(schema) && schema.layoutFieldMeta === "dynamic-item-field"
    )

    const itemGroupView = dynamicView.items[0]?.children.find(
      (schema) =>
        isViewGroupSchema(schema) && schema.layoutGroupMeta === "dynamic-item-group"
    )

    expect(itemFieldView).toMatchObject({
      layout: itemFieldLayout,
      layoutFieldMeta: "dynamic-item-field",
    })
    expect(itemGroupView).toMatchObject({
      layout: itemGroupLayout,
      layoutGroupMeta: "dynamic-item-group",
    })

    if (!itemFieldView || !isSchemxViewFieldSchema(itemFieldView)) {
      throw new Error("Dynamic item Field ViewSchema 未生成")
    }

    if (!itemGroupView || !isViewGroupSchema(itemGroupView)) {
      throw new Error("Dynamic item Group ViewSchema 未生成")
    }

    expect(itemFieldView.layout).toBe(itemFieldLayout)
    expect(itemGroupView.layout).toBe(itemGroupLayout)
    expect(itemGroupView.children[0]).toMatchObject({
      layout: itemChildLayout,
      layoutFieldMeta: "dynamic-item-child",
    })

    form.destroy()
  })

  it("保留 Field.col、Group.row 和 Dynamic.row 元数据", () => {
    const fieldCol = { span: 12, offset: 1 }

    const groupRow = {}

    const dynamicRow = {}

    const form = createForm<FormValues>({
      initialValues: {
        title: "表单",
        groupTitle: "分组标题",
        users: [{ name: "Ada", email: "ada@example.com" }],
      },
      schemas: [
        {
          name: "title",
          label: "标题",
          componentType: "input",
          col: fieldCol,
        },
        {
          label: "用户信息",
          row: groupRow,
          children: [],
        },
        {
          key: "users-schema",
          name: "users",
          row: dynamicRow,
          item: [
            {
              name: "name",
              label: "姓名",
              componentType: "input",
              col: fieldCol,
            },
          ],
        },
      ],
    })

    const views = form.getViewSchemas()

    const fieldView = views.find(
      (schema) => isSchemxViewFieldSchema(schema) && schema.name === "title"
    )

    const groupView = views.find((schema) => isViewGroupSchema(schema))

    const dynamicView = views.find((schema) => isViewDynamicSchema(schema))

    if (!fieldView || !isSchemxViewFieldSchema(fieldView)) {
      throw new Error("Field ViewSchema 未生成")
    }

    if (!groupView || !isViewGroupSchema(groupView)) {
      throw new Error("Group ViewSchema 未生成")
    }

    if (!dynamicView || !isViewDynamicSchema(dynamicView)) {
      throw new Error("Dynamic ViewSchema 未生成")
    }

    expect(fieldView.col).toBe(fieldCol)
    expect(groupView.row).toBe(groupRow)
    expect(dynamicView.row).toBe(dynamicRow)
    expect(dynamicView.items[0]?.children[0]).toMatchObject({ col: fieldCol })

    form.destroy()
  })

  it("Schema 更新后同步更新 Field ViewSchema 的 layout", () => {
    const initialLayout = { span: 12 }

    const nextLayout = { span: 6, offset: 2 }

    const form = createForm<FormValues>({
      schemas: [
        {
          name: "title",
          label: "标题",
          componentType: "input",
          layout: initialLayout,
        },
      ],
    })

    const initialView = form.getViewSchemas()[0]

    if (!initialView || !isSchemxViewFieldSchema(initialView)) {
      throw new Error("Field ViewSchema 未生成")
    }

    expect(initialView.layout).toBe(initialLayout)

    form.setSchemas([
      {
        name: "title",
        label: "标题",
        componentType: "input",
        layout: nextLayout,
      },
    ])

    const nextView = form.getViewSchemas()[0]

    if (!nextView || !isSchemxViewFieldSchema(nextView)) {
      throw new Error("更新后的 Field ViewSchema 未生成")
    }

    expect(nextView.layout).toBe(nextLayout)

    form.destroy()
  })
})
