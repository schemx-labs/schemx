import { describe, expect, it, vi } from "vitest"

import {
  createForm,
  createSchemas,
  isSchemxViewFieldSchema,
  type SchemxField,
} from "../../index"

interface DependencyValues {
  flag: boolean
  name: string
  derived: string
}

describe("runtime regression cases", () => {
  it("移除字段 dependencies 后恢复静态呈现和校验", async () => {
    const schemas = createSchemas<DependencyValues>([
      {
        key: "name-field",
        name: "name",
        label: "姓名",
        componentType: "input",
        required: true,
        dependencies: {
          triggerFields: ["flag"],
          visible: () => false,
        },
      },
    ])

    const form = createForm<DependencyValues>({
      schemas,
      initialValues: { flag: true, name: "", derived: "" },
    })

    await form.validate()
    expect(form.getViewSchemas()[0]).toMatchObject({ visible: false })

    schemas.set([
      {
        key: "name-field",
        name: "name",
        label: "姓名",
        componentType: "input",
        required: true,
        visible: true,
      },
    ])

    const result = await form.validate()

    const field = form.getViewSchemas()[0]

    const errorNames = result.errors.flatMap((error) =>
      "name" in error ? [error.name] : []
    )

    expect(field && isSchemxViewFieldSchema(field) && field.visible).toBe(true)
    expect(result.valid).toBe(false)
    expect(errorNames).toContain("name")

    form.destroy()
  })

  it("全局默认配置刷新已生成的 dependency 子字段且不重跑 renderer", async () => {
    const renderer = vi.fn((): SchemxField<DependencyValues>[] => [
      {
        name: "derived",
        label: "派生字段",
        componentType: "input",
      },
    ])

    const form = createForm<DependencyValues>({
      initialValues: { flag: true, name: "ok", derived: "" },
      schemas: [
        {
          key: "dependency",
          to: ["flag"],
          renderer,
        },
      ],
    })

    await form.validate()
    expect(renderer).toHaveBeenCalledTimes(1)

    form.updateSchemaConfig({ required: true, labelWidth: "200px" })

    const result = await form.validate()

    const derived = form
      .getViewSchemas()
      .find((schema) => isSchemxViewFieldSchema(schema) && schema.name === "derived")

    const errorNames = result.errors.flatMap((error) =>
      "name" in error ? [error.name] : []
    )

    expect(renderer).toHaveBeenCalledTimes(1)
    expect(derived).toMatchObject({
      name: "derived",
      required: true,
      labelWidth: "200px",
    })
    expect(errorNames).toContain("derived")

    form.destroy()
  })

  it("静态字段不能与已生成的 dependency 字段重名", async () => {
    const schemas = createSchemas<DependencyValues>([
      {
        key: "dependency",
        to: ["flag"],
        renderer: () => [
          {
            name: "derived",
            label: "派生字段",
            componentType: "input",
            required: true,
          },
        ],
      },
    ])

    const form = createForm<DependencyValues>({
      schemas,
      initialValues: { flag: true, name: "", derived: "" },
    })

    await form.validate()

    expect(() =>
      schemas.set([
        {
          name: "derived",
          label: "静态字段",
          componentType: "input",
        },
        ...schemas.peek(),
      ])
    ).toThrow(/Duplicate field name "derived"/)

    const result = await form.validate()

    expect(
      form
        .getViewSchemas()
        .flatMap((schema) => (isSchemxViewFieldSchema(schema) ? [schema.name] : []))
    ).toEqual(["derived"])
    expect(result.valid).toBe(false)

    form.destroy()
  })
})
