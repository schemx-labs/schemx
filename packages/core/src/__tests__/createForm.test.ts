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

import { createSchemas } from "../createSchemas"
import { createForm } from "../createForm"

describe("CreateFormInstance 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 10: onValuesChange 回调正确性
  // **Validates: Requirements 8.7, 8.8**
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
import { createRendererRegistry } from "../registry"

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

describe("渲染器注册中心下沉 属性测试", () => {
  // **Feature: renderer-registry-into-createform, Property 1: 自定义 RendererRegistry 传递**
  // **Validates: Requirements 1.1, 5.2**
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

  // **Feature: renderer-registry-into-createform, Property 2: getRenderer 委托一致性**
  // **Validates: Requirements 2.1**
  it("Property 2: form.getRenderer(type) 与 registry.getRenderer(type) 返回值始终一致", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(safeTypeStr, { minLength: 1, maxLength: 10 }),
        safeTypeStr,
        (registeredTypes, queryType) => {
          const registry = createRendererRegistry()

          for (const type of registeredTypes) {
            registry.register(type, { __type: type })
          }

          const form = createForm({ rendererRegistry: registry })

          expect(form.getRenderer(queryType)).toBe(
            registry.getRenderer(queryType)
          )

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // **Feature: renderer-registry-into-createform, Property 3: 注册-查询往返**
  // **Validates: Requirements 2.2, 2.3**
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

  // **Feature: renderer-registry-into-createform, Property 4: form 实例内部 registry 优先**
  // **Validates: Requirements 6.3**
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
            expect(result).toBe(registryA.getRenderer(type))
            expect(result).not.toBe(registryB.getRenderer(type))
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
import { createRendererRegistry, createValidatorsRegistry } from "../registry"

import type { StandardSchemaV1 } from "../types"

describe("渲染器注册中心下沉 单元测试", () => {
  it("form 返回对象包含 getRenderer、registerRenderer、hasRenderer 方法", () => {
    const form = createForm({})

    expect(typeof form.getRenderer).toBe("function")
    expect(typeof form.registerRenderer).toBe("function")
    expect(typeof form.hasRenderer).toBe("function")

    form.destroy()
  })

  // 8.3 验证外部传入 form 实例时渲染器正确关联
  // Validates: Requirements 5.1, 5.2
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

describe("字段规则注册上下文 单元测试", () => {
  it("createForm 应该注册并触发生命周期 hooks", () => {
    const mount = vi.fn()
    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
        },
      ],
      lifecycleHooks: {
        mount,
      },
    })

    expect(mount).toHaveBeenCalledTimes(1)
    expect(mount.mock.calls[0][0]).toMatchObject({
      type: "field",
      descriptor: {
        type: "field",
        schema: {
          name: "name",
        },
      },
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
          componentType: "dependency",
          to: ["orderType"],
          renderer: (values: any) => {
            if (values.orderType !== "standard") return []

            return [
              {
                label: "标准订单配置",
                componentType: "group",
                children: [
                  {
                    name: "expectedDate",
                    label: "预计日期",
                    componentType: "date",
                    required: true,
                    rules: "required",
                  },
                  {
                    name: "deliveryMode",
                    label: "配送方式",
                    componentType: "radio",
                  },
                  {
                    componentType: "dependency",
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
                          rules: "required",
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
    form.setFieldValue("expectedDate", "2026-05-09")
    form.setFieldValue("deliveryMode", "pickup")
    form.setFieldValue("pickupStore", "hubin")

    await form.waitForDependencies()

    expect(form.getFieldValue("expectedDate")).toBe("2026-05-09")
    expect(form.getFieldValue("deliveryMode")).toBe("pickup")
    expect(form.getFieldValue("pickupStore")).toBe("hubin")

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
          componentType: "dependency",
          to: ["orderType"],
          renderer: (values: any) => {
            if (values.orderType !== "standard") return []

            return [
              {
                label: "标准订单配置",
                componentType: "group",
                children: [
                  {
                    name: "deliveryMode",
                    label: "配送方式",
                    componentType: "radio",
                    initialValue: "courier",
                  },
                  {
                    componentType: "dependency",
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

    expect(form.getFieldValue("deliveryMode")).toBe("courier")
    expect(form.getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        componentType: "group",
        children: [{ name: "deliveryMode" }, { name: "receiverPhone" }],
      },
    ])

    form.destroy()
  })

  it("registerRules 使用 resolved schema 为字符串工厂规则补充字段上下文", async () => {
    const form = createForm({
      initialValues: { user: { name: "Alice" } },
      schemas: [
        {
          componentType: "group",
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

    form.registerValidator("contextual", (schema) => ({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: schema?.label ?? "missing schema" }],
        }),
      },
    }))

    form.unregisterRules("user.name" as any)
    form.registerRules("user.name" as any, "contextual")

    const result = await form.validateField("user.name" as any)

    expect(result.ok).toBe(false)
    expect(form.getFieldError("user.name" as any)).toEqual(["User Name"])

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
 * @param id - 用于区分不同 mock 实例的标识符
 * @returns 符合 StandardSchemaV1 接口的 mock 对象
 */
function createMockStandardSchema(id: string): StandardSchemaV1 {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => ({ value }),
    },
  } as StandardSchemaV1
}

describe("RulesRegistry 快捷方法 属性测试", () => {
  // **Feature: rules-registry-and-getinternals, Property 1: 注册-查询往返**
  // **Validates: Requirements 3.1, 3.2, 4.1**
  it("Property 1: registerRule 后 hasRule 返回 true 且 getRule 返回该 rule", () => {
    fc.assert(
      fc.property(safeRuleName, fc.string({ minLength: 1 }), (name, schemaId) => {
        const form = createForm({ validatorRegistry: createValidatorsRegistry() })
        const rule = createMockStandardSchema(schemaId)

        form.registerValidator(name, rule)

        expect(form.hasValidator(name)).toBe(true)
        expect(form.getValidator(name)).toBe(rule)

        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // **Feature: rules-registry-and-getinternals, Property 2: 覆盖注册**
  // **Validates: Requirements 3.3**
  it("Property 2: 后注册的 rule 覆盖先注册的同名 rule", () => {
    fc.assert(
      fc.property(safeRuleName, (name) => {
        const form = createForm({ validatorRegistry: createValidatorsRegistry() })
        const ruleA = createMockStandardSchema("A")
        const ruleB = createMockStandardSchema("B")

        form.registerValidator(name, ruleA)
        form.registerValidator(name, ruleB)

        expect(form.getValidator(name)).toBe(ruleB)
        expect(form.getValidator(name)).not.toBe(ruleA)

        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // **Feature: rules-registry-and-getinternals, Property 4: 跨路径注册-查询往返一致性**
  // **Validates: Requirements 6.1, 6.2, 7.1, 7.2, 7.3**
  it("Property 4: 通过快捷方法注册后 form 能查到，反之亦然（规则和渲染器）", () => {
    fc.assert(
      fc.property(
        safeRuleName,
        safeTypeStr,
        fc.string({ minLength: 1 }),
        (ruleName, rendererType, schemaId) => {
          const form = createForm({
            rendererRegistry: createRendererRegistry(),
            validatorRegistry: createValidatorsRegistry(),
          })
          const rule = createMockStandardSchema(schemaId)
          const renderer = { __type: rendererType }

          // 路径 A: 通过 form 注册规则并查询
          form.registerValidator(ruleName, rule)
          expect(form.getValidator(ruleName)).toBe(rule)

          // 路径 B: 注册另一个规则并查询
          const rule2 = createMockStandardSchema(schemaId + "_2")
          form.registerValidator(ruleName + "_via_internals", rule2)
          expect(form.getValidator(ruleName + "_via_internals")).toBe(rule2)

          // 路径 C: 通过 form 注册渲染器并查询
          form.registerRenderer(rendererType, renderer)
          expect(form.getRenderer(rendererType)).toBe(renderer)

          // 路径 D: 注册另一个渲染器并查询
          const renderer2 = { __type: rendererType + "_2" }
          form.registerRenderer(rendererType + "_via_internals", renderer2)
          expect(
            form.getRenderer(rendererType + "_via_internals")
          ).toBe(renderer2)

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
describe("RulesRegistry 快捷方法单元测试", () => {
  // 6.1 验证 createForm 返回对象包含 getRule、registerRule、hasRule 方法
  // Validates: Requirements 1.1, 1.2, 1.3, 5.4
  it("createForm 返回对象包含 getRule、registerRule、hasRule 方法", () => {
    const form = createForm({ validatorRegistry: createValidatorsRegistry() })

    expect(typeof form.getValidator).toBe("function")
    expect(typeof form.registerValidator).toBe("function")
    expect(typeof form.hasValidator).toBe("function")

    form.destroy()
  })

  // 6.2 验证 createForm 返回对象包含 rendererRegistry 和 rulesRegistry 快捷方法
  // Validates: Requirements 5.1, 5.2, 5.3
  it("form 返回对象包含 getRenderer、registerRenderer、getRule、registerRule、hasRule 方法", () => {
    const form = createForm({ validatorRegistry: createValidatorsRegistry() })
    const hooks = form

    expect(hooks).toBeDefined()
    expect(typeof hooks.getRenderer).toBe("function")
    expect(typeof hooks.registerRenderer).toBe("function")
    expect(typeof hooks.hasRenderer).toBe("function")
    expect(typeof hooks.getValidator).toBe("function")
    expect(typeof hooks.registerValidator).toBe("function")
    expect(typeof hooks.hasValidator).toBe("function")

    form.destroy()
  })

  // 6.3 验证未注册的规则名称 getRule 返回 undefined 且 hasRule 返回 false
  // Validates: Requirements 2.3, 4.3
  it("未注册的规则名称 getRule 返回 undefined 且 hasRule 返回 false", () => {
    const form = createForm({ validatorRegistry: createValidatorsRegistry() })

    expect(form.getValidator("__nonexistent_rule__")).toBeUndefined()
    expect(form.hasValidator("__nonexistent_rule__")).toBe(false)

    form.destroy()
  })

  // 6.4 验证传入自定义 rendererRegistry 后，form 使用该 registry 的渲染器
  // Validates: Requirements 5.2
  it("传入自定义 rendererRegistry 后，通过 form 能获取其中的渲染器", () => {
    const customRegistry = createRendererRegistry()
    const testRenderer = { component: "Test" }
    customRegistry.register("test-type", testRenderer)

    const form = createForm({ rendererRegistry: customRegistry })

    expect(form.getRenderer("test-type")).toBe(testRenderer)

    form.destroy()
  })
})

describe("destroy 清理", () => {
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

describe("动态 schemas", () => {
  it("setSchemas 后更新 ViewSchemas 并保留已有字段值", () => {
    const form = createForm({
      initialValues: { name: "Alice" } as any,
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
      ],
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

  it("updateSchemas 支持基于当前 schemas 派生下一版", () => {
    const form = createForm({
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
      ],
    })

    form.updateSchemas((schemas) => [
      ...schemas,
      { name: "email", label: "邮箱", componentType: "input" },
    ])

    expect(form.getViewSchemas()).toHaveLength(2)
    expect(form.getViewSchemas()[1]).toMatchObject({
      name: "email",
      label: "邮箱",
    })

    form.destroy()
  })

  it("setSchemas 仅修改 group 属性时通知 ViewSchemas 订阅", () => {
    const form = createForm({
      schemas: [
        { componentType: "group", label: "旧分组", children: [] },
      ] as any,
    })
    const calls: unknown[] = []
    const unsubscribe = form.subscribeViewSchemas((schemas) => {
      calls.push(schemas)
    })

    form.setSchemas([
      { componentType: "group", label: "新分组", children: [] },
    ] as any)

    expect(calls.at(-1)).toMatchObject([{ label: "新分组" }])

    unsubscribe()
    form.destroy()
  })

  it("接收 createSchemas 返回的 schema source 并响应外部更新", () => {
    const schemas = createSchemas([
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
    const schemas = createSchemas([
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
