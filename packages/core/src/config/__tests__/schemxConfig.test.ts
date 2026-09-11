import { afterEach, describe, expect, it, vi } from "vitest"

import { createForm } from "../../createForm"
import { createRendererRegistry } from "../../registry"
import { configureSchemx } from "../schemxConfig"

import type { SchemxViewFieldSchema, SchemxViewSchema } from "../../runtime/view/types"
import type { SchemxRendererPropsMap, Values } from "../../types"
import type {
  AdapterRule,
  ValidationAdapter,
  ValidationRule,
} from "../../validator/types"

function createTestAdapter<TInput>(
  id: string,
  resolve: (rule: AdapterRule | TInput) => readonly ValidationRule[]
): ValidationAdapter<TInput> & { rule: (input: TInput) => AdapterRule } {
  const rules = new WeakSet<object>()

  return {
    id,
    rule(input) {
      const rule = Object.freeze({ adapterId: id, payload: input })

      rules.add(rule)

      return rule
    },
    isRule(value): value is AdapterRule {
      return typeof value === "object" && value !== null && rules.has(value)
    },
    resolve: resolve as ValidationAdapter<TInput>["resolve"],
  }
}

afterEach(() => configureSchemx())

function findField<TValues extends Values>(
  form: { getViewSchemas: () => readonly SchemxViewSchema<TValues>[] },
  name: string
): SchemxViewFieldSchema<TValues> | undefined {
  return form
    .getViewSchemas()
    .find((s): s is SchemxViewFieldSchema<TValues> => "name" in s && s.name === name)
}

describe("configureSchemx", () => {
  it("仅影响之后创建的 Form，并由 Form adapter 覆盖同 id 全局 adapter", async () => {
    const globalAdapter = createTestAdapter("test", () => [
      {
        validate: () => ({
          valid: false as const,
          issues: [{ type: "validation", message: "全局" }],
        }),
      },
    ])

    const formAdapter = createTestAdapter("test", () => [
      {
        validate: () => ({
          valid: false as const,
          issues: [{ type: "validation", message: "表单" }],
        }),
      },
    ])

    configureSchemx({ validatorAdapters: [globalAdapter] })
    const globalForm = createForm<{ email: string }>({
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [globalAdapter.rule("x")],
        },
      ],
    })

    const form = createForm<{ email: string }>({
      validatorAdapters: [{ adapter: formAdapter, override: true }],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [formAdapter.rule("x")],
        },
      ],
    })

    configureSchemx({ validatorAdapters: [] })

    await expect(globalForm.validateField("email")).resolves.toMatchObject({
      errors: [{ issues: [{ message: "全局" }] }],
    })
    await expect(form.validateField("email")).resolves.toMatchObject({
      errors: [{ issues: [{ message: "表单" }] }],
    })
  })

  it.each([null, 1, {}, "   "])("创建 Form 时拒绝非法 adapter id %j", (id) => {
    expect(() => createForm({ validatorAdapters: [{ id } as never] })).toThrow(
      "校验 adapter id 必须为非空字符串或 symbol"
    )
  })

  it("仅显式 override 才允许覆盖同 ID adapter", () => {
    const first = createTestAdapter("same", () => [])

    const second = createTestAdapter("same", () => [])

    expect(() => createForm({ validatorAdapters: [first, second] })).toThrow(
      '重复的校验 adapter id "same"'
    )
    expect(() =>
      createForm({ validatorAdapters: [first, { adapter: second, override: true }] })
    ).not.toThrow()
  })

  it("全局 schemaConfig 作为后续 Form 的字段默认值", async () => {
    configureSchemx({ schemaConfig: { readonly: true } })
    const form = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    await Promise.resolve()

    expect(findField(form, "name")?.readonly).toBe(true)
  })

  it("Form 显式传入的字段默认值覆盖全局 schemaConfig", async () => {
    configureSchemx({ schemaConfig: { readonly: true } })
    const form = createForm<{ name: string }>({
      schemaConfig: { readonly: false },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    await Promise.resolve()

    expect(findField(form, "name")?.readonly).toBe(false)
  })

  it("按全局、Form、字段优先级合并 Renderer Props，并隔离全局配置快照", () => {
    const globalOnChange = () => undefined

    const formOnBlur = () => undefined

    const nestedRendererValue = { theme: "light" }

    const globalRendererProps = {
      input: {
        placeholder: "全局占位",
        readonlyPlaceholder: "全局空值",
        onChange: globalOnChange,
        metadata: nestedRendererValue,
      },
    } as SchemxRendererPropsMap

    configureSchemx({ rendererProps: globalRendererProps })

    if (!globalRendererProps.input) {
      throw new Error("测试 Renderer Props 缺少 input 配置")
    }

    globalRendererProps.input.readonlyPlaceholder = "已修改的全局空值"
    globalRendererProps.input = { placeholder: "已替换的全局占位" }
    nestedRendererValue.theme = "dark"

    const form = createForm<{ name: string }>({
      rendererProps: {
        input: {
          placeholder: "Form 占位",
          onBlur: formOnBlur,
        },
      },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          componentProps: { placeholder: "字段占位" },
        },
      ],
    })

    const componentProps = findField(form, "name")?.componentProps

    expect(componentProps).toMatchObject({
      placeholder: "字段占位",
      readonlyPlaceholder: "全局空值",
      onChange: globalOnChange,
      onBlur: formOnBlur,
    })
    expect((componentProps as { metadata?: unknown }).metadata).toBe(nestedRendererValue)
    expect(nestedRendererValue).toEqual({ theme: "dark" })

    form.destroy()
  })

  it("Form 显式传入 undefined 时回到内置默认值", async () => {
    configureSchemx({ schemaConfig: { readonly: true } })
    const form = createForm<{ name: string }>({
      schemaConfig: { readonly: undefined },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    await Promise.resolve()

    expect(findField(form, "name")?.readonly).toBe(false)
  })

  it("动态配置显式更新为 undefined 时回到内置默认值", async () => {
    const form = createForm<{ name: string }>({
      schemaConfig: { readonly: true },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form.updateSchemaConfig({ readonly: undefined })
    await Promise.resolve()

    expect(findField(form, "name")?.readonly).toBe(false)
  })

  it("全局 showRequiredMark 覆盖必填字段的标记显示", async () => {
    configureSchemx({ schemaConfig: { showRequiredMark: false } })
    const form = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input", required: true }],
    })

    await Promise.resolve()

    expect(findField(form, "name")?.showRequiredMark).toBe(false)
  })

  it("未设置全局 showRequiredMark 时必填字段仍显示标记", async () => {
    const form = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input", required: true }],
    })

    await Promise.resolve()

    expect(findField(form, "name")?.showRequiredMark).toBe(true)
  })

  it("全局 rendererRegistry 在多个 Form 间共享", () => {
    const registry = createRendererRegistry()

    configureSchemx({ rendererRegistry: registry })

    const form1 = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    const form2 = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form1.registerRenderer("shared", "SHARED_COMP")
    expect(form2.hasRenderer("shared")).toBe(true)
  })

  it("未设置全局 rendererRegistry 时各 Form 使用独立私有注册表", () => {
    const form1 = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    const form2 = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form1.registerRenderer("private", "PRIVATE_COMP")
    expect(form2.hasRenderer("private")).toBe(false)
  })

  it("全局 defaultRendererType 作为未注入注册表的 fallback 类型", () => {
    configureSchemx({ defaultRendererType: "text" })
    const form = createForm<{ name: string }>({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form.registerRenderer("text", "TEXT_COMP")

    // 未注册的 unknown 类型回退到全局 defaultRendererType "text"
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(form.getRenderer("unknown")).toBe("TEXT_COMP")
    vi.mocked(console.warn).mockRestore()
  })
})
