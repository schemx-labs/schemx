/**
 * CreateFormInstance 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createForm 工厂函数创建的表单实例的正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/createForm
 */

import fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { createFormStateAdapter } from "../adapter"
import { createForm } from "../createForm"
import { createSchemas } from "../createSchemas"
import { createPresetRuleRegistry, createRendererRegistry } from "../registry"
import { isFieldNode } from "../runtime/node/helper"

interface StudentFormValues {
  student: Array<{
    id: string
    studentName: string
  }>
  profile: {
    name: string
  }
}

describe("字段初始值", () => {
  it("Schema initialValue 初始化不应触发 onValuesChange", () => {
    const onValuesChange = vi.fn()

    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          initialValue: "Alice",
        },
      ],
      onValuesChange,
    })

    expect(onValuesChange).not.toHaveBeenCalled()

    form.destroy()
  })

  it("字段 initialValue 应成为 reset 的初始值基准", () => {
    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          initialValue: "Alice",
        },
      ],
    })

    expect(form.getFieldValue("name")).toBe("Alice")
    expect(form.getInitialValue("name")).toBe("Alice")

    form.setFieldValue("name", "Bob")
    form.reset()

    expect(form.getFieldValue("name")).toBe("Alice")
    form.destroy()
  })
})

describe("字段值边界", () => {
  it("Schema 数组字段应作为整体接收 setFieldsValue 回填", () => {
    const form = createForm<StudentFormValues>({
      initialValues: {
        student: [],
        profile: { name: "Ada" },
      },
      schemas: [
        { name: "student", label: "学生", componentType: "picker" },
        { name: "profile.name", label: "姓名", componentType: "input" },
      ],
    })

    const stateAdapter = createFormStateAdapter(form)

    const studentStore = stateAdapter.field("student")

    const listener = vi.fn()

    const unsubscribe = studentStore.subscribe(listener)

    const student = [{ id: "1", studentName: "唐馨语" }]

    form.setFieldsValue({ student })

    expect(form.getFieldValue("student")).toEqual(student)
    expect(form.getFieldsValue()).toEqual({
      student,
      profile: { name: "Ada" },
    })
    expect(studentStore.getSnapshot().value).toEqual(student)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    stateAdapter.dispose()
    form.destroy()
  })

  it("注册数组字段前写入的叶子路径应在字段挂载时归并", () => {
    const form = createForm<StudentFormValues>()

    const student = [{ id: "1", studentName: "唐馨语" }]

    form.setFieldsValue({ student })
    form.setSchemas([{ name: "student", label: "学生", componentType: "picker" }])

    expect(form.getFieldValue("student")).toEqual(student)

    form.destroy()
  })

  it("数组字段的初始值与 reset 应共享字段边界", () => {
    const form = createForm<StudentFormValues>({
      schemas: [{ name: "student", label: "学生", componentType: "picker" }],
    })

    const initialStudent = [{ id: "1", studentName: "唐馨语" }]

    const nextStudent = [{ id: "2", studentName: "林默" }]

    form.setInitialValues({ student: initialStudent })
    form.setFieldValue("student", nextStudent)
    form.reset()

    expect(form.getFieldValue("student")).toEqual(initialStudent)

    form.destroy()
  })
})

describe("表单提交", () => {
  it("字段未配置 rules 时应应用 fieldRules 兜底", async () => {
    const form = createForm<{ email?: string }>({
      initialValues: { email: "" },
      schemas: [{ name: "email", label: "邮箱", componentType: "input" }],
      fieldRules: {
        email: ({ name, label, required }) => ({
          validate: () => ({
            valid: false,
            issues: [
              {
                type: "validation",
                message: `${String(name)}:${label}:${required}`,
              },
            ],
          }),
        }),
      },
    })

    const result = await form.validate()

    expect(result.valid).toBe(false)
    if (!result.valid && !result.cancelled) {
      expect(result.errors[0]?.issues[0]?.message).toBe("email:邮箱:false")
    }

    form.destroy()
  })

  it("字段自身 rules 应优先于 fieldRules", async () => {
    const form = createForm<{ email?: string }>({
      initialValues: { email: "" },
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [
            {
              validate: () => ({ valid: true }),
            },
          ],
        },
      ],
      fieldRules: {
        email: {
          validate: () => ({
            valid: false,
            issues: [{ type: "validation", message: "表单级规则" }],
          }),
        },
      },
    })

    const result = await form.validate()

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.values).toEqual({ email: "" })
    }

    form.destroy()
  })

  it("fieldRules 支持命名 preset 和规则数组", async () => {
    const presetRuleRegistry = createPresetRuleRegistry()

    presetRuleRegistry.register("nonEmpty" as never, {
      validate: (value: unknown) =>
        value
          ? { valid: true }
          : {
              valid: false,
              issues: [{ type: "validation", message: "名称为空" }],
            },
    })

    const form = createForm<{ name?: string }>({
      initialValues: { name: "" },
      presetRuleRegistry,
      fieldRules: {
        name: [
          "nonEmpty",
          {
            validate: () => ({ valid: true }),
          },
        ] as never,
      },
      schemas: [{ name: "name", label: "名称", componentType: "input" }],
    })

    const result = await form.validate()

    expect(result.valid).toBe(false)
    if (!result.valid && !result.cancelled) {
      expect(result.errors[0]?.issues).toEqual([
        { type: "validation", message: "名称为空" },
      ])
    }

    form.destroy()
  })

  it("required 不依赖 fieldRules，并由内置规则单独执行", async () => {
    const form = createForm<{ email?: string }>({
      initialValues: { email: "" },
      fieldRules: {
        email: {
          validate: () => ({ valid: true }),
        },
      },
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          required: true,
        },
      ],
    })

    const result = await form.validate()

    expect(result).toMatchObject({
      valid: false,
      errors: [
        {
          scope: "field",
          name: "email",
          issues: [{ type: "validation", message: "邮箱为必填项", code: "required" }],
        },
      ],
    })

    form.destroy()
  })

  it("初始化后立即 validate 应等待 schema 规则注册", async () => {
    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
    })

    const result = await form.validate()

    expect(result).toEqual({
      valid: false,
      values: { name: "" },
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ type: "validation", message: "姓名为必填项", code: "required" }],
        },
      ],
    })
    form.destroy()
  })

  it("应返回成功校验结果并调用 onFinish", async () => {
    const onFinish = vi.fn()

    const form = createForm({
      initialValues: { name: "Alice" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
      onFinish,
    })

    const result = await form.submit()

    expect(result).toEqual({ valid: true, values: { name: "Alice" }, errors: [] })
    expect(onFinish).toHaveBeenCalledWith({ name: "Alice" })
    form.destroy()
  })

  it("应返回失败校验结果并调用 onFinishFailed", async () => {
    const onFinishFailed = vi.fn()

    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
      onFinishFailed,
    })

    const result = await form.submit()

    expect(result).toEqual({
      valid: false,
      values: { name: "" },
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ type: "validation", message: "姓名为必填项", code: "required" }],
        },
      ],
    })
    if (!result.valid) {
      expect(onFinishFailed).toHaveBeenCalledWith(result)
    }

    form.destroy()
  })

  it("validateField 返回字段名收窄的扁平错误", async () => {
    const form = createForm<{ email: string }>({
      initialValues: { email: "" },
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          required: true,
        },
      ],
    })

    const result = await form.validateField("email")

    expect(result).toEqual({
      valid: false,
      values: { email: "" },
      errors: [
        {
          scope: "field",
          name: "email",
          issues: [{ type: "validation", message: "邮箱为必填项", code: "required" }],
        },
      ],
    })
    form.destroy()
  })

  it("pending 字段返回字段级错误并同步错误状态", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const form = createForm({ initialValues: { avatar: "" } })

    try {
      form.setFieldPending("avatar", true, "头像上传中")

      const result = await form.validate()

      expect(result).toEqual({
        valid: false,
        values: { avatar: "" },
        errors: [
          {
            scope: "field",
            name: "avatar",
            issues: [{ type: "external", message: "头像上传中", code: "pending" }],
          },
        ],
      })
      expect(form.getFieldErrors("avatar")).toEqual(["头像上传中"])
      expect(consoleWarn).toHaveBeenCalledWith(
        "[schemx] 存在正在操作中的字段: avatar，请等待完成后再提交"
      )
    } finally {
      form.destroy()
      consoleWarn.mockRestore()
    }
  })

  it("依赖等待超时返回表单级错误", async () => {
    vi.useFakeTimers()
    const onFinish = vi.fn()

    const onFinishFailed = vi.fn()

    const form = createForm({
      initialValues: { mode: "async" },
      schemas: [
        { name: "mode", label: "模式", componentType: "input" },
        {
          to: ["mode"],
          renderer: () => new Promise<never>(() => undefined),
        },
      ] as any,
      onFinish,
      onFinishFailed,
    })

    const submission = form.submit()

    await vi.advanceTimersByTimeAsync(10_000)

    await expect(submission).resolves.toEqual({
      valid: false,
      values: { mode: "async" },
      errors: [
        {
          scope: "form",
          issues: [
            {
              type: "validation",
              message: "表单依赖解析超时，请稍后重试",
              code: "dependency_timeout",
            },
          ],
        },
      ],
    })
    expect(onFinish).not.toHaveBeenCalled()
    expect(onFinishFailed).not.toHaveBeenCalled()

    form.destroy()
    vi.useRealTimers()
  })
})

// 属性测试：验证 createForm 创建的表单实例 onValuesChange 回调的正确性
describe("CreateFormInstance 属性测试", () => {
  // 功能：pure-signal-core-refactor；属性 10：onValuesChange 回调正确性
  // **验证：需求 8.7、8.8**
  it("Property 10: 对于任意字段路径和值变更，onValuesChange 应接收正确的 changedValues", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1 })
          .filter(
            (s) =>
              !s.includes(".") &&
              !s.includes("[") &&
              !s.includes("]") &&
              s.trim().length > 0 &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        fc.integer(),
        fc.integer(),
        (path, initialValue, newValueRaw) => {
          // 确保 newValue 与 initialValue 不同，否则 signal 不触发 effect
          const newValue = initialValue === newValueRaw ? newValueRaw + 1 : newValueRaw

          // 记录回调接收到的参数
          let receivedChangedValues: any = null

          let receivedLatestSnapshot: any = null

          // 创建配置了 onValuesChange 的表单实例
          const form = createForm({
            initialValues: { [path]: initialValue } as any,
            onValuesChange: (changedValues, latestSnapshot) => {
              receivedChangedValues = changedValues
              receivedLatestSnapshot = latestSnapshot
            },
          })

          // 修改字段值，触发回调
          form.setFieldValue(path, newValue)

          // 验证回调被触发且 changedValues 包含正确的字段和值
          expect(receivedChangedValues).toBeDefined()
          expect((receivedChangedValues as any)[path]).toBe(newValue)

          // 验证 latestSnapshot 包含最新值
          expect(receivedLatestSnapshot).toBeDefined()
          expect((receivedLatestSnapshot as any)[path]).toBe(newValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * 渲染器注册中心下沉 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createForm 与 RendererRegistry 集成的正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/createForm (renderer-registry)
 */
/**
 * 安全类型字符串生成器：过滤空字符串、含点号字符串和原型相关字符串
 */
const safeTypeStr = fc
  .string({ minLength: 1 })
  .filter(
    (s) =>
      !s.includes(".") &&
      s.trim().length > 0 &&
      !["__proto__", "constructor", "prototype"].includes(s)
  )

// 属性测试：验证 createForm 与 RendererRegistry 集成的正确性（自定义 registry 传递、委托一致性、注册-查询往返）
describe("渲染器注册中心下沉 属性测试", () => {
  // **功能：renderer-registry-into-createform；属性 1：自定义 RendererRegistry 传递**
  // **验证：需求 1.1、5.2**
  it("Property 1: 传入自定义 RendererRegistry 后，form 对每个已注册类型返回正确的渲染器", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(safeTypeStr, { minLength: 1, maxLength: 10 }),
        (types) => {
          const registry = createRendererRegistry()

          const renderers: Record<string, object> = {}

          for (const type of types) {
            const renderer = { __type: type }

            renderers[type] = renderer
            registry.register(type, renderer)
          }

          const form = createForm({ rendererRegistry: registry })

          for (const type of types) {
            expect(form.getRenderer(type)).toBe(renderers[type])
          }

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // **功能：renderer-registry-into-createform；属性 2：getRenderer 委托一致性**
  // **验证：需求 2.1**
  it("Property 2: form.getRenderer(type) 与 registry.resolve(type) 返回值始终一致", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(safeTypeStr, { minLength: 1, maxLength: 10 }),
        (registeredTypes) => {
          const registry = createRendererRegistry()

          for (const type of registeredTypes) {
            registry.register(type, { __type: type })
          }

          const form = createForm({ rendererRegistry: registry })

          const registeredType = registeredTypes[0]

          expect(form.getRenderer(registeredType)).toBe(registry.resolve(registeredType))

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // **功能：renderer-registry-into-createform；属性 3：注册-查询往返**
  // **验证：需求 2.2、2.3**
  it("Property 3: registerRenderer 后 hasRenderer 返回 true 且 getRenderer 返回该渲染器", () => {
    fc.assert(
      fc.property(safeTypeStr, fc.object({ maxDepth: 1 }), (type, rendererObj) => {
        const registry = createRendererRegistry()

        const form = createForm({ rendererRegistry: registry })

        form.registerRenderer(type, rendererObj)

        expect(form.hasRenderer(type)).toBe(true)
        expect(form.getRenderer(type)).toBe(rendererObj)

        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // **功能：renderer-registry-into-createform；属性 4：form 实例内部 registry 优先**
  // **验证：需求 6.3**
  it("Property 4: form 实例始终使用内部 registry，而非外部其他 registry", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(safeTypeStr, { minLength: 1, maxLength: 5 }),
        (types) => {
          const registryA = createRendererRegistry()

          const registryB = createRendererRegistry()

          for (const type of types) {
            registryA.register(type, { source: "A", __type: type })
            registryB.register(type, { source: "B", __type: type })
          }

          const form = createForm({ rendererRegistry: registryA })

          for (const type of types) {
            const result = form.getRenderer(type)

            expect(result).toBe(registryA.resolve(type))
            expect(result).not.toBe(registryB.resolve(type))
          }

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * 渲染器注册中心下沉 单元测试
 *
 * 验证 createForm 与 RendererRegistry 集成的具体行为。
 *
 * @module core/__tests__/createForm (renderer-registry unit tests)
 */
import type { StandardSchemaV1 } from "../types"

// 单元测试：验证 createForm 返回对象包含 getRenderer/registerRenderer/hasRenderer 方法
describe("渲染器注册中心下沉 单元测试", () => {
  it("所有 Schema 注入路径共享 createForm 返回的同一个实例", () => {
    const form = createForm({
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
        },
      ],
    })

    expect(form.getViewSchemas()[0]).toMatchObject({
      componentProps: { formInstance: form },
    })

    form.destroy()
  })

  it("销毁 Node 时 FormModel 仍然可用", () => {
    let valueDuringUnmount: string | undefined

    const form = createForm<{ name: string }>({
      initialValues: { name: "Alice" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
        },
      ],
      lifecycleHooks: {
        unmounted() {
          valueDuringUnmount = form.getFieldValue("name")
        },
      },
    })

    form.destroy()

    expect(valueDuringUnmount).toBe("Alice")
  })

  it("createForm 跳过不合规 Schema 并输出错误日志", () => {
    const customRegistry = createRendererRegistry("registry-default")

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      const form = createForm({
        rendererRegistry: customRegistry,
        schemas: [
          { name: "email", label: "" } as any,
          { name: "name", label: "姓名", componentType: "text" },
        ],
      })

      expect(form.getViewSchemas()).toHaveLength(1)
      expect(form.getViewSchemas()[0]).toMatchObject({ name: "name" })
      expect(errorSpy).toHaveBeenCalledWith(
        "[schemx] schema.componentType 必须是非空字符串"
      )

      form.destroy()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it("form 返回对象包含 getRenderer、registerRenderer、hasRenderer 方法", () => {
    const form = createForm({})

    expect(typeof form.getRenderer).toBe("function")
    expect(typeof form.registerRenderer).toBe("function")
    expect(typeof form.hasRenderer).toBe("function")

    form.destroy()
  })

  // 8.3 验证外部传入 form 实例时渲染器正确关联
  // 验证：需求 5.1、5.2
  it("外部传入自定义 rendererRegistry 时，form 使用该 registry 的渲染器", () => {
    const customRegistry = createRendererRegistry()

    const inputRenderer = { component: "CustomInput" }

    const selectRenderer = { component: "CustomSelect" }

    customRegistry.register("input", inputRenderer)
    customRegistry.register("select", selectRenderer)

    const form = createForm({ rendererRegistry: customRegistry })

    // 验证 form 返回自定义 registry 中注册的渲染器
    expect(form.getRenderer("input")).toBe(inputRenderer)
    expect(form.getRenderer("select")).toBe(selectRenderer)

    // 验证 hasRenderer 也正确关联
    expect(form.hasRenderer("input")).toBe(true)
    expect(form.hasRenderer("select")).toBe(true)

    form.destroy()
  })
})

// 单元测试：验证 createForm 生命周期 hooks、dependency 子树水合、字段规则注册等集成行为
describe("字段规则注册上下文 单元测试", () => {
  it("createForm 应该注册并触发生命周期 hooks", () => {
    const mounted = vi.fn()

    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
        },
      ],
      lifecycleHooks: {
        mounted,
      },
    })

    expect(mounted).toHaveBeenCalledTimes(1)
    expect(mounted.mock.calls[0][0]).toMatchObject({
      type: "field",
      key: "field:name",
    })
    expect(mounted.mock.calls[0][0]).toMatchObject({
      name: { value: "name" },
      staticSchema: { value: { name: "name", componentType: "input" } },
    })

    form.destroy()
  })

  it("dependency 子树挂载时应该水合挂载前写入的字段值", async () => {
    const submitted: any[] = []

    const form = createForm({
      initialValues: { orderType: "express" },
      schemas: [
        {
          name: "orderType",
          label: "订单类型",
          componentType: "selector",
          initialValue: "express",
        },
        {
          to: ["orderType"],
          renderer: async (values: any) => {
            await Promise.resolve()

            if (values.orderType !== "standard") return []

            return [
              {
                label: "标准订单配置",
                children: [
                  {
                    name: "expectedDate",
                    label: "预计日期",
                    componentType: "date",
                    required: true,
                  },
                  {
                    name: "deliveryMode",
                    label: "配送方式",
                    componentType: "radio",
                  },
                  {
                    to: ["deliveryMode"],
                    renderer: (deliveryValues: any) => {
                      if (deliveryValues.deliveryMode !== "pickup") return []

                      return [
                        {
                          name: "pickupStore",
                          label: "自提门店",
                          componentType: "selector",
                          initialValue: "mixc",
                          required: true,
                        },
                      ]
                    },
                  },
                ],
              },
            ]
          },
        },
      ] as any,
      onFinish: (values) => {
        submitted.push(values)
      },
    })

    await form.waitForDependencies()

    form.setFieldValue("orderType", "standard")
    form.setFieldValue("expectedDate" as never, "2026-05-09" as never)
    form.setFieldValue("deliveryMode" as never, "pickup" as never)
    form.setFieldValue("pickupStore" as never, "hubin" as never)

    await form.waitForDependencies()

    expect(form.getFieldValue("expectedDate" as never)).toBe("2026-05-09")
    expect(form.getFieldValue("deliveryMode" as never)).toBe("pickup")
    expect(form.getFieldValue("pickupStore" as never)).toBe("hubin")

    await form.submit()

    expect(submitted).toHaveLength(1)
    expect(submitted[0]).toMatchObject({
      orderType: "standard",
      expectedDate: "2026-05-09",
      deliveryMode: "pickup",
      pickupStore: "hubin",
    })

    form.destroy()
  })

  it("dependency 子树字段的 initialValue 应驱动嵌套 dependency 展开", async () => {
    const form = createForm({
      initialValues: { orderType: "standard" },
      schemas: [
        {
          name: "orderType",
          label: "订单类型",
          componentType: "selector",
        },
        {
          to: ["orderType"],
          renderer: (values: any) => {
            if (values.orderType !== "standard") return []

            return [
              {
                label: "标准订单配置",
                children: [
                  {
                    name: "deliveryMode",
                    label: "配送方式",
                    componentType: "radio",
                    initialValue: "courier",
                  },
                  {
                    to: ["deliveryMode"],
                    renderer: (deliveryValues: any) => {
                      if (deliveryValues.deliveryMode !== "courier") return []

                      return [
                        {
                          name: "receiverPhone",
                          label: "收件电话",
                          componentType: "input",
                        },
                      ]
                    },
                  },
                ],
              },
            ]
          },
        },
      ] as any,
    })

    await form.waitForDependencies()

    expect(form.getFieldValue("deliveryMode" as never)).toBe("courier")
    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        children: [{ name: "deliveryMode" }, { name: "receiverPhone" }],
      },
    ])

    form.destroy()
  })

  it("dependency renderer 切换到 group 分支后应输出 group children", async () => {
    const renderer = vi.fn((values: any) => {
      if (values.orderType === "standard") {
        return [
          {
            label: "标准订单配置",
            children: [
              {
                name: "quantity",
                label: "数量",
                componentType: "stepper",
              },
              {
                name: "expectedDate",
                label: "预计日期",
                componentType: "date",
              },
            ],
          },
        ]
      }

      if (values.orderType !== "express") {
        return []
      }

      return [
        {
          label: "加急订单配置",
          children: [
            {
              name: "expressLevel",
              label: "加急等级",
              componentType: "selector",
            },
            {
              name: "expressFee",
              label: "加急费用",
              componentType: "slider",
            },
          ],
        },
      ]
    })

    const form = createForm<{ orderType: string }>({
      initialValues: { orderType: "standard" },
      schemas: [
        {
          name: "orderType",
          label: "订单类型",
          componentType: "selector",
        },
        {
          to: ["orderType"],
          renderer,
        },
      ] as any,
    })

    await form.waitForDependencies()

    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        label: "标准订单配置",
        children: [{ name: "quantity" }, { name: "expectedDate" }],
      },
    ])

    form.setFieldValue("orderType", "express")
    await form.waitForDependencies()

    expect(renderer).toHaveBeenCalledTimes(2)
    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        label: "加急订单配置",
        children: [{ name: "expressLevel" }, { name: "expressFee" }],
      },
    ])

    form.destroy()
  })

  it("dependency 切换分支后应使用新子树字段 initialValue 驱动嵌套 dependency 展开", async () => {
    const form = createForm<{ orderType: string }>({
      initialValues: { orderType: "standard" },
      schemas: [
        {
          name: "orderType",
          label: "订单类型",
          componentType: "selector",
        },
        {
          to: ["orderType"],
          renderer: (values: any) => {
            if (values.orderType === "standard") {
              return [
                {
                  label: "标准订单配置",
                  children: [
                    {
                      name: "quantity",
                      label: "数量",
                      componentType: "stepper",
                    },
                  ],
                },
              ]
            }

            if (values.orderType !== "express") {
              return []
            }

            return [
              {
                label: "加急订单配置",
                children: [
                  {
                    name: "expressLevel",
                    label: "加急等级",
                    componentType: "selector",
                    initialValue: "priority",
                  },
                  {
                    to: ["expressLevel"],
                    renderer: (expressValues: any) => {
                      if (expressValues.expressLevel !== "priority") {
                        return []
                      }

                      return [
                        {
                          name: "expressFee",
                          label: "加急费用",
                          componentType: "slider",
                        },
                      ]
                    },
                  },
                ],
              },
            ]
          },
        },
      ] as any,
    })

    await form.waitForDependencies()
    form.setFieldValue("orderType", "express")
    await form.waitForDependencies()

    expect(form.getFieldValue("expressLevel" as never)).toBe("priority")
    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        label: "加急订单配置",
        children: [{ name: "expressLevel" }, { name: "expressFee" }],
      },
    ])

    form.destroy()
  })

  it("初始化后立即更新默认属性不应阻断 dependency 初始子树提交", async () => {
    const form = createForm<{ orderType: string }>({
      initialValues: { orderType: "standard" },
      schemas: [
        {
          name: "orderType",
          label: "订单类型",
          componentType: "selector",
        },
        {
          to: ["orderType"],
          renderer: (values: any) => {
            if (values.orderType !== "standard") return []

            return [
              {
                label: "标准订单配置",
                children: [
                  {
                    name: "quantity",
                    label: "数量",
                    componentType: "stepper",
                  },
                ],
              },
            ]
          },
        },
      ] as any,
    })

    const unsubscribe = form.subscribeViewSchemas(() => undefined)

    form.updateSchemaConfig({
      required: undefined,
      readonly: undefined,
      disabled: undefined,
      visible: undefined,
      labelIcon: undefined,
      labelAlign: undefined,
      labelPosition: undefined,
      labelWidth: undefined,
      validationTrigger: undefined,
      colon: undefined,
    } as any)
    await form.waitForDependencies()

    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        label: "标准订单配置",
        children: [{ name: "quantity" }],
      },
    ])

    unsubscribe()
    form.destroy()
  })

  it("setFieldRules 使用运行时字段状态为字符串工厂规则补充上下文", async () => {
    const presetRuleRegistry = createPresetRuleRegistry()

    presetRuleRegistry.register("contextual" as never, (context) => ({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: context.label }],
        }),
      },
    }))
    const form = createForm<{ user: { name: string } }>({
      initialValues: { user: { name: "Alice" } },
      presetRuleRegistry,
      schemas: [
        {
          label: "User Group",
          children: [
            {
              componentType: "input",
              name: "user.name",
              label: "User Name",
            },
          ],
        },
      ] as any,
    })

    await form.waitForDependencies()
    form.removeFieldRules("user.name" as any)
    form.setFieldRules("user.name" as any, "contextual" as never)

    const result = await form.validateField("user.name" as any)

    expect(result.valid).toBe(false)
    expect(form.getFieldErrors("user.name" as any)).toEqual(["User Name"])

    form.destroy()
  })

  it("未设置运行时覆盖时 removeFieldRules 保留 Schema 规则", async () => {
    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
    })

    form.removeFieldRules("name")

    await expect(form.validateField("name")).resolves.toEqual({
      valid: false,
      values: { name: "" },
      errors: [
        {
          scope: "field",
          name: "name",
          issues: [{ type: "validation", message: "姓名为必填项", code: "required" }],
        },
      ],
    })
    form.destroy()
  })
})

/**
 * RulesRegistry 快捷方法 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createForm 与 RulesRegistry 集成的正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/createForm (rules-registry)
 */

/**
 * 安全规则名称生成器：过滤空字符串、含点号字符串和原型相关字符串
 */
const safeRuleName = fc
  .string({ minLength: 1 })
  .filter(
    (s) =>
      !s.includes(".") &&
      s.trim().length > 0 &&
      !["__proto__", "constructor", "prototype"].includes(s)
  )

/**
 * 创建 mock StandardSchemaV1 实例
 *
 * @param _id - 用于区分不同 mock 实例的标识符
 * @returns 符合 StandardSchemaV1 接口的 mock 对象
 */
function createMockStandardSchema(_id: string): StandardSchemaV1 {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => ({ value }),
    },
  } as StandardSchemaV1
}

// 属性测试：验证 createForm 与 RulesRegistry 集成的注册-查询往返、覆盖注册、跨路径一致性
describe("RulesRegistry 快捷方法 属性测试", () => {
  // **功能：rules-registry-and-getinternals；属性 1：注册-查询往返**
  // **验证：需求 3.1、3.2、4.1**
  it("Property 1: registerPresetRule 后 hasPresetRule 返回 true 且 getPresetRule 返回该 rule", () => {
    fc.assert(
      fc.property(safeRuleName, fc.string({ minLength: 1 }), (name, schemaId) => {
        const form = createForm({
          presetRuleRegistry: createPresetRuleRegistry(),
        })

        const rule = createMockStandardSchema(schemaId)

        form.registerPresetRule(name, rule)

        expect(form.hasPresetRule(name)).toBe(true)
        expect(form.getPresetRule(name)).toBe(rule)

        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // **功能：rules-registry-and-getinternals；属性 2：覆盖注册**
  // **验证：需求 3.3**
  it("Property 2: 后注册的 rule 覆盖先注册的同名 rule", () => {
    fc.assert(
      fc.property(safeRuleName, (name) => {
        const form = createForm({
          presetRuleRegistry: createPresetRuleRegistry(),
        })

        const ruleA = createMockStandardSchema("A")

        const ruleB = createMockStandardSchema("B")

        form.registerPresetRule(name, ruleA)
        form.registerPresetRule(name, ruleB)

        expect(form.getPresetRule(name)).toBe(ruleB)
        expect(form.getPresetRule(name)).not.toBe(ruleA)

        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // **功能：rules-registry-and-getinternals；属性 4：跨路径注册-查询往返一致性**
  // **验证：需求 6.1、6.2、7.1、7.2、7.3**
  it("Property 4: 通过快捷方法注册后 form 能查到，反之亦然（规则和渲染器）", () => {
    fc.assert(
      fc.property(
        safeRuleName,
        safeTypeStr,
        fc.string({ minLength: 1 }),
        (ruleName, rendererType, schemaId) => {
          const form = createForm({
            rendererRegistry: createRendererRegistry(),
            presetRuleRegistry: createPresetRuleRegistry(),
          })

          const rule = createMockStandardSchema(schemaId)

          const renderer = { __type: rendererType }

          // 路径 A: 通过 form 注册规则并查询
          form.registerPresetRule(ruleName, rule)
          expect(form.getPresetRule(ruleName)).toBe(rule)

          // 路径 B: 注册另一个规则并查询
          const rule2 = createMockStandardSchema(schemaId + "_2")

          form.registerPresetRule(ruleName + "_via_internals", rule2)
          expect(form.getPresetRule(ruleName + "_via_internals")).toBe(rule2)

          // 路径 C: 通过 form 注册渲染器并查询
          form.registerRenderer(rendererType, renderer)
          expect(form.getRenderer(rendererType)).toBe(renderer)

          // 路径 D: 注册另一个渲染器并查询
          const renderer2 = { __type: rendererType + "_2" }

          form.registerRenderer(rendererType + "_via_internals", renderer2)
          expect(form.getRenderer(rendererType + "_via_internals")).toBe(renderer2)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * RulesRegistry 快捷方法单元测试
 *
 * 验证 createForm 与 RulesRegistry 集成的具体行为。
 *
 * @module core/__tests__/createForm (rules-registry-getinternals unit tests)
 */
// 单元测试：验证 createForm 返回对象包含 getPresetRule/registerPresetRule/hasPresetRule 方法
describe("RulesRegistry 快捷方法单元测试", () => {
  // 6.1 验证 createForm 返回对象包含 getPresetRule、registerPresetRule、hasPresetRule 方法
  // 验证：需求 1.1、1.2、1.3、5.4
  it("createForm 返回对象包含 getPresetRule、registerPresetRule、hasPresetRule 方法", () => {
    const form = createForm({
      presetRuleRegistry: createPresetRuleRegistry(),
    })

    expect(typeof form.getPresetRule).toBe("function")
    expect(typeof form.registerPresetRule).toBe("function")
    expect(typeof form.hasPresetRule).toBe("function")

    form.destroy()
  })

  // 6.2 验证 createForm 返回对象包含 rendererRegistry 和 presetRuleRegistry 快捷方法
  // 验证：需求 5.1、5.2、5.3
  it("form 返回对象包含 getRenderer、registerRenderer、getPresetRule、registerPresetRule、hasPresetRule 方法", () => {
    const form = createForm({
      presetRuleRegistry: createPresetRuleRegistry(),
    })

    const hooks = form

    expect(hooks).toBeDefined()
    expect(typeof hooks.getRenderer).toBe("function")
    expect(typeof hooks.registerRenderer).toBe("function")
    expect(typeof hooks.hasRenderer).toBe("function")
    expect(typeof hooks.getPresetRule).toBe("function")
    expect(typeof hooks.registerPresetRule).toBe("function")
    expect(typeof hooks.hasPresetRule).toBe("function")

    form.destroy()
  })

  // 6.3 验证未注册的规则名称 getPresetRule 返回 undefined 且 hasPresetRule 返回 false
  // 验证：需求 2.3、4.3
  it("未注册的规则名称 getPresetRule 返回 undefined 且 hasPresetRule 返回 false", () => {
    const form = createForm({
      presetRuleRegistry: createPresetRuleRegistry(),
    })

    expect(form.getPresetRule("__nonexistent_rule__")).toBeUndefined()
    expect(form.hasPresetRule("__nonexistent_rule__")).toBe(false)

    form.destroy()
  })

  // 6.4 验证传入自定义 rendererRegistry 后，form 使用该 registry 的渲染器
  // 验证：需求 5.2
  it("传入自定义 rendererRegistry 后，通过 form 能获取其中的渲染器", () => {
    const customRegistry = createRendererRegistry()

    const testRenderer = { component: "Test" }

    customRegistry.register("test-type", testRenderer)

    const form = createForm({ rendererRegistry: customRegistry })

    expect(form.getRenderer("test-type")).toBe(testRenderer)

    form.destroy()
  })
})

// 验证 destroy 后 onValuesChange 不再触发、setFieldValue 不报错
describe("destroy 清理", () => {
  it("destroy 后断开 Runtime 与 Controller bindings，公开 API 保持安全降级", () => {
    const form = createForm({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form.destroy()

    expect(() => form.setSchemas([])).not.toThrow()
    expect(form.getViewSchemas()).toEqual([])
  })

  it("destroy 后 onValuesChange 不再被触发", () => {
    const onValuesChange = vi.fn()

    const form = createForm({
      initialValues: { name: "a" } as any,
      onValuesChange,
    })

    form.setFieldValue("name", "b")

    expect(onValuesChange).toHaveBeenCalledTimes(1)

    form.destroy()
    form.setFieldValue("name", "c")

    expect(onValuesChange).toHaveBeenCalledTimes(1)
  })

  it("destroy 后 setFieldValue 仍可调用但不再触发回调", () => {
    const form = createForm({
      initialValues: { name: "a" } as any,
    })

    form.destroy()

    expect(() => {
      form.setFieldValue("name", "z")
    }).not.toThrow()
  })
})

// 验证 setSchemas/updateSchemas 动态更新 ViewSchemas 的行为
describe("动态 schemas", () => {
  it("setSchemas 后更新 ViewSchemas 并保留已有字段值", () => {
    const form = createForm({
      initialValues: { name: "Alice" } as any,
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form.setFieldValue("name", "Bob")
    form.setSchemas([
      { name: "name", label: "用户姓名", componentType: "input" },
      { name: "age", label: "年龄", componentType: "input" },
    ])

    const schemas = form.getViewSchemas()

    expect(schemas).toHaveLength(2)
    expect(schemas[0]).toMatchObject({ name: "name", label: "用户姓名" })
    expect(schemas[1]).toMatchObject({ name: "age", label: "年龄" })
    expect(form.getFieldValue("name")).toBe("Bob")

    form.destroy()
  })

  it("移除 group 子树时应该递归发送子字段 unmount 事件", () => {
    const unmounted = vi.fn()

    const form = createForm({
      schemas: [
        {
          label: "用户信息",
          children: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
      lifecycleHooks: {
        unmounted,
      },
    })

    form.setSchemas([])

    expect(
      unmounted.mock.calls.some(
        ([node]) => isFieldNode(node) && node.key.endsWith("/name")
      )
    ).toBe(true)

    form.destroy()
  })

  it("updateSchemas 支持基于当前 schemas 派生下一版", () => {
    const form = createForm({
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    form.updateSchemas((schemas) => [
      ...schemas,
      { name: "email", label: "邮箱", componentType: "input" } as never,
    ])

    expect(form.getViewSchemas()).toHaveLength(2)
    expect(form.getViewSchemas()[1]).toMatchObject({
      name: "email",
      label: "邮箱",
    })

    form.destroy()
  })

  it("setSchemas 仅修改 group 属性时通知 ViewSchemas 订阅", async () => {
    vi.useFakeTimers()
    const form = createForm({
      schemas: [{ label: "旧分组", children: [] }] as any,
    })

    const calls: unknown[] = []

    const unsubscribe = form.subscribeViewSchemas((schemas) => {
      calls.push(schemas)
    })

    try {
      form.setSchemas([{ label: "新分组", children: [] }] as any)
      await vi.advanceTimersByTimeAsync(16)

      expect(calls.at(-1)).toMatchObject([{ label: "新分组" }])
    } finally {
      unsubscribe()
      form.destroy()
      vi.useRealTimers()
    }
  })

  it("接收 createSchemas 返回的 schema source 并响应外部更新", () => {
    const schemas = createSchemas<{ name: string; email: string }>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    const form = createForm({
      schemas,
    })

    schemas.update((current) => [
      ...current,
      { name: "email", label: "邮箱", componentType: "input" },
    ])

    expect(form.getViewSchemas()).toHaveLength(2)
    expect(form.getViewSchemas()[1]).toMatchObject({
      name: "email",
      label: "邮箱",
    })

    form.destroy()
  })

  it("destroy 后取消 schema source 订阅", () => {
    const schemas = createSchemas<{ name: string; email: string }>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    const form = createForm({
      schemas,
    })

    form.destroy()
    schemas.set([{ name: "email", label: "邮箱", componentType: "input" }])

    expect(form.getViewSchemas()).toEqual([])
  })
})
