/**
 * Schema 移除时 preserve 值清理测试。
 *
 * @module core/__tests__/preserve
 */

import { describe, expect, it } from "vitest"

import { createForm } from "../createForm"
import { createSchemas } from "../createSchemas"

interface TestValues {
  toggle?: boolean
  name?: string
  nickname?: string
  user?: {
    name?: string
    city?: string
  }
}

describe("Schema preserve", () => {
  it("默认保留移除字段的当前值", () => {
    const schemas = createSchemas<TestValues>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    const form = createForm<TestValues>({
      schemas,
      initialValues: { name: "Ada" },
    })

    schemas.set([])

    expect(form.getFieldsValue()).toEqual({ name: "Ada" })
    form.destroy()
  })

  it("preserve 为 false 时删除当前值并清理交互状态", () => {
    const schemas = createSchemas<TestValues>([
      {
        name: "user.name",
        label: "姓名",
        componentType: "input",
        preserve: false,
      },
    ])

    const form = createForm<TestValues>({
      schemas,
      initialValues: { user: { name: "Ada", city: "Beijing" } },
    })

    form.setFieldTouched("user.name", true)
    form.setFieldPending("user.name", true, "保存中")
    schemas.set([])

    expect(form.getFieldsValue()).toEqual({ user: { city: "Beijing" } })
    expect(form.getInitialValue("user.name")).toBe("Ada")
    expect(form.isFieldTouched("user.name")).toBe(false)
    expect(form.isFieldPending("user.name")).toBe(false)
    form.destroy()
  })

  it("替换同名字段时不误删新节点的值", () => {
    const schemas = createSchemas<TestValues>([
      {
        key: "old",
        name: "name",
        label: "旧字段",
        componentType: "input",
        preserve: false,
      },
    ])

    const form = createForm<TestValues>({ schemas, initialValues: { name: "Ada" } })

    schemas.set([
      {
        key: "new",
        name: "name",
        label: "新字段",
        componentType: "input",
      },
    ])

    expect(form.getFieldValue("name")).toBe("Ada")
    form.destroy()
  })

  it("字段改名时按旧 schema 的 preserve 清理旧路径", () => {
    const schemas = createSchemas<TestValues>([
      {
        key: "field",
        name: "name",
        label: "姓名",
        componentType: "input",
        preserve: false,
      },
    ])

    const form = createForm<TestValues>({
      schemas,
      initialValues: { name: "Ada", nickname: "A" },
    })

    schemas.set([
      {
        key: "field",
        name: "nickname",
        label: "昵称",
        componentType: "input",
      },
    ])

    expect(form.getFieldsValue()).toEqual({ nickname: "A" })
    expect(form.getInitialValue("name")).toBe("Ada")
    form.destroy()
  })

  it("dependency renderer 移除字段时应用 preserve", async () => {
    const schemas = createSchemas<TestValues>([
      {
        key: "dependency",
        to: ["toggle"],
        renderer: (values) =>
          values.toggle
            ? [
                {
                  name: "name",
                  label: "姓名",
                  componentType: "input",
                  preserve: false,
                },
              ]
            : [],
      },
    ])

    const form = createForm<TestValues>({
      schemas,
      initialValues: { toggle: true, name: "Ada" },
    })

    await form.waitForDependencies()
    form.setFieldValue("toggle", false)
    await form.waitForDependencies()

    expect(form.getFieldsValue()).toEqual({ toggle: false })
    form.destroy()
  })

  it("父路径移除时保留仍存活的子字段", () => {
    const schemas = createSchemas<TestValues>([
      {
        key: "parent",
        name: "user",
        label: "用户",
        componentType: "input",
        preserve: false,
      },
      {
        key: "child",
        name: "user.name",
        label: "姓名",
        componentType: "input",
      },
    ])

    const form = createForm<TestValues>({
      schemas,
      initialValues: { user: { name: "Ada", city: "Beijing" } },
    })

    const childSchema = schemas.peek()[1]

    if (!childSchema) {
      throw new Error("子字段 schema 不应为空")
    }

    schemas.set([childSchema])

    expect(form.getFieldValue("user.name")).toBe("Ada")
    form.destroy()
  })
})
