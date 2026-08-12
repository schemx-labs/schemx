/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { defineComponent, h, markRaw, nextTick, ref, watchEffect } from "vue"

import {
  createForm,
  createRendererRegistry,
  createValidationRuleRegistry,
  type ValidationAdapter,
  type Values,
} from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Schemx from "../form"
import SchemxForm from "../form.vue"
import { validationRuleRegistry } from "../utils/rulesProvider"

const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

const SelectorRenderer = defineComponent({
  name: "SelectorRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  setup(props) {
    return () =>
      h("button", {
        "data-testid": "selector-renderer",
        type: "button",
        onClick: () => props.onChange?.("express"),
      })
  },
})

const CountRenderer = defineComponent({
  name: "CountRenderer",
  props: {
    count: Number,
  },
  setup(props) {
    return () =>
      h("div", {
        "data-testid": "count-renderer",
        "data-count": String(props.count),
      })
  },
})

/**
 * 创建只返回固定失败结果的测试 adapter。
 *
 * 通过 WeakSet 保留品牌规则语义，确保测试验证的是 adapter 是否真正进入
 * Form 的 ValidationController，而不是仅凭对象形状被误识别。
 *
 * @param id - adapter 标识。
 * @param message - adapter 生成的错误消息。
 * @returns 可用于 Schema 与 Form 配置的 adapter。
 */
function createTestAdapter(id: string, message: string): ValidationAdapter<string> {
  const rules = new WeakSet<object>()

  return {
    id,
    rule(input) {
      const rule = Object.freeze({ adapterId: id, payload: input })

      rules.add(rule)

      return rule
    },
    isRule(value) {
      return typeof value === "object" && value !== null && rules.has(value)
    },
    resolve() {
      return [
        {
          validate: () => ({
            valid: false as const,
            issues: [{ message }],
          }),
        },
      ]
    },
  }
}

describe("SchemxForm 动态 schemas", () => {
  it("受控 modelValue 原地更新字段后应同步到字段整体插槽", async () => {
    const rendererRegistry = createRendererRegistry()

    const modelValue = ref<{ age: string; username?: string }>({ age: "1" })

    rendererRegistry.register("input", markRaw(InputRenderer))

    const ControlledForm = defineComponent({
      setup() {
        return () =>
          h(
            SchemxForm,
            {
              rendererRegistry,
              modelValue: modelValue.value,
              schemas: [
                {
                  name: "username",
                  label: "用户名",
                  componentType: "input",
                },
              ],
              "onUpdate:modelValue": (nextValues) => {
                modelValue.value = nextValues as typeof modelValue.value
              },
            },
            {
              username: (slotProps: { value?: string }) =>
                h("span", { "data-testid": "username-slot" }, slotProps.value),
            }
          )
      },
    })

    const wrapper = mount(ControlledForm)

    expect(wrapper.get('[data-testid="username-slot"]').text()).toBe("")

    modelValue.value.username = "Alice"
    await nextTick()

    expect(wrapper.get('[data-testid="username-slot"]').text()).toBe("Alice")

    wrapper.unmount()
  })

  it("受控 modelValue 回显后应更新子渲染器的字段 props", async () => {
    const rendererRegistry = createRendererRegistry()

    const modelValue = ref<{ username?: string }>({})

    const receivedValues: Array<string | undefined> = []

    const ValueRenderer = defineComponent({
      name: "ValueRenderer",
      props: {
        value: String,
      },
      setup(props) {
        watchEffect(() => {
          receivedValues.push(props.value)
        })

        return () => h("span", { "data-testid": "value-renderer" }, props.value)
      },
    })

    rendererRegistry.register("value", markRaw(ValueRenderer))

    const ControlledForm = defineComponent({
      setup() {
        return () =>
          h(SchemxForm, {
            rendererRegistry,
            modelValue: modelValue.value,
            schemas: [
              {
                name: "username",
                label: "用户名",
                componentType: "value",
              },
            ],
          })
      },
    })

    const wrapper = mount(ControlledForm)

    modelValue.value = { username: "Alice" }
    await nextTick()

    expect(wrapper.get('[data-testid="value-renderer"]').text()).toBe("Alice")
    expect(receivedValues).toEqual([undefined, "Alice"])

    wrapper.unmount()
  })

  it("通过组件 expose 的 setFieldsValue 回显后应更新子渲染器的字段 props", async () => {
    const rendererRegistry = createRendererRegistry()

    const receivedValues: Array<string | undefined> = []

    const ValueRenderer = defineComponent({
      name: "ValueRenderer",
      props: {
        value: String,
      },
      setup(props) {
        watchEffect(() => {
          receivedValues.push(props.value)
        })

        return () => h("span", { "data-testid": "value-renderer" }, props.value)
      },
    })

    rendererRegistry.register("value", markRaw(ValueRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            name: "username",
            label: "用户名",
            componentType: "value",
          },
        ],
      },
    })

    ;(wrapper.vm as any).setFieldsValue({ username: "Alice" })
    await nextTick()

    expect(wrapper.get('[data-testid="value-renderer"]').text()).toBe("Alice")
    expect(receivedValues).toEqual([undefined, "Alice"])

    wrapper.unmount()
  })

  it("应将字段值转发给字段整体插槽并保持更新", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        modelValue: { username: "Alice" },
        schemas: [
          {
            name: "username",
            label: "用户名",
            componentType: "input",
          },
        ],
      },
      slots: {
        username: (slotProps: { value?: string }) =>
          h("span", { "data-testid": "username-slot" }, slotProps.value),
      },
    })

    expect(wrapper.get('[data-testid="username-slot"]').text()).toBe("Alice")

    ;(wrapper.vm as any).setFieldValue("username", "Bob")
    await nextTick()

    expect(wrapper.get('[data-testid="username-slot"]').text()).toBe("Bob")

    wrapper.unmount()
  })

  it("将 validatorAdapters Prop 传递给内部 Form 并执行 adapter", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const adapter = createTestAdapter("vue-form-adapter", "adapter 校验失败")

    const rule = adapter.rule

    if (!rule) {
      throw new Error("测试 adapter 必须提供 rule")
    }

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        validatorAdapters: [adapter],
        schemas: [
          {
            name: "email",
            label: "邮箱",
            componentType: "input",
            rules: rule("invalid"),
          },
        ],
      },
    })

    const result = await (wrapper.vm as any).validate()

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      {
        scope: "field",
        name: "email",
        issues: [{ message: "adapter 校验失败" }],
      },
    ])

    wrapper.unmount()
  })

  it("表单显式 validatorAdapters 优先于 App 安装配置", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const appAdapter = createTestAdapter("priority-adapter", "App adapter")

    const formAdapter = createTestAdapter("priority-adapter", "Form adapter")

    const rule = formAdapter.rule

    if (!rule) {
      throw new Error("测试 adapter 必须提供 rule")
    }

    const wrapper = mount(SchemxForm, {
      global: {
        plugins: [[Schemx, { validatorAdapters: [appAdapter] }]],
      },
      props: {
        rendererRegistry,
        validatorAdapters: [{ adapter: formAdapter, override: true }],
        schemas: [
          {
            name: "email",
            label: "邮箱",
            componentType: "input",
            rules: rule("invalid"),
          },
        ],
      },
    })

    const result = await (wrapper.vm as any).validate()

    expect(result.valid).toBe(false)
    expect(result.errors?.[0]?.issues).toEqual([{ message: "Form adapter" }])

    wrapper.unmount()
  })

  it("默认使用 Vue 全局 ValidationRuleRegistry", async () => {
    const ruleName = "vue-global-rule-test"

    validationRuleRegistry.register(ruleName, {
      validate: () => ({
        valid: false,
        issues: [{ message: "全局规则失败" }],
      }),
    })

    try {
      const rendererRegistry = createRendererRegistry()

      rendererRegistry.register("input", markRaw(InputRenderer))

      const wrapper = mount(SchemxForm, {
        props: {
          rendererRegistry,
          schemas: [
            {
              name: "name",
              label: "姓名",
              componentType: "input",
              rules: ruleName,
            },
          ],
        },
      })

      const result = await (wrapper.vm as any).validate()

      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        {
          scope: "field",
          name: "name",
          issues: [{ message: "全局规则失败" }],
        },
      ])

      wrapper.unmount()
    } finally {
      validationRuleRegistry.unregister(ruleName)
    }
  })

  it("局部 ValidationRuleRegistry 优先于 Vue 全局实例", async () => {
    const ruleName = "vue-local-rule-test"

    validationRuleRegistry.register(ruleName, {
      validate: () => ({ valid: true }),
    })

    const localRegistry = createValidationRuleRegistry()

    localRegistry.register(ruleName, {
      validate: () => ({
        valid: false,
        issues: [{ message: "局部规则失败" }],
      }),
    })

    try {
      const rendererRegistry = createRendererRegistry()

      rendererRegistry.register("input", markRaw(InputRenderer))

      const wrapper = mount(SchemxForm, {
        props: {
          rendererRegistry,
          validationRuleRegistry: localRegistry,
          schemas: [
            {
              name: "name",
              label: "姓名",
              componentType: "input",
              rules: ruleName,
            },
          ],
        },
      })

      const result = await (wrapper.vm as any).validate()

      expect(result.valid).toBe(false)
      expect(result.errors[0]?.issues).toEqual([{ message: "局部规则失败" }])

      wrapper.unmount()
    } finally {
      validationRuleRegistry.unregister(ruleName)
    }
  })

  it("group 和 dependency 可以作为普通 Renderer key", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("group", markRaw(InputRenderer))
    rendererRegistry.register("dependency", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          { name: "groupField", label: "Group 字段", componentType: "group" },
          {
            name: "dependencyField",
            label: "Dependency 字段",
            componentType: "dependency",
          },
        ],
      },
    })

    await nextTick()

    expect(wrapper.findAll('[data-testid="input-renderer"]')).toHaveLength(2)
    expect(wrapper.find(".schemx-group").exists()).toBe(false)

    wrapper.unmount()
  })

  it("字段变化时以最新表单快照同步 modelValue", async () => {
    const wrapper = mount(SchemxForm, {
      props: {
        initialValues: { name: "Alice" },
        schemas: [],
      },
    })

    ;(wrapper.vm as any).setFieldValue("name", "Bob")
    await nextTick()

    const emissions = wrapper.emitted("update:modelValue")

    expect(emissions?.at(-1)).toEqual([{ name: "Bob" }])

    wrapper.unmount()
  })

  it("外部 Core Form 会归一化为 Facade，并保持 v-model 同步", async () => {
    const form = createForm<Values>({ initialValues: { name: "Alice" } })

    const wrapper = mount(SchemxForm, {
      props: {
        form,
        modelValue: { name: "Alice" },
        schemas: [],
      },
    })

    ;(wrapper.vm as any).setFieldValue("name", "Bob")
    await nextTick()

    expect(form.getFieldValue("name")).toBe("Bob")
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([{ name: "Bob" }])

    wrapper.unmount()
    form.destroy()
  })

  it("外部 schemas prop 更新后同步 ViewSchemas", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [{ name: "name", label: "姓名", componentType: "input" }],
      },
    })

    await nextTick()

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).not.toContain("年龄")

    await wrapper.setProps({
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
        { name: "age", label: "年龄", componentType: "input" },
      ],
    })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).toContain("年龄")

    wrapper.unmount()
  })

  it("dependency 切换到嵌套 group 分支后渲染新增 children", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("selector", markRaw(SelectorRenderer))
    rendererRegistry.register("stepper", markRaw(InputRenderer))
    rendererRegistry.register("slider", markRaw(InputRenderer))
    let dependencyCalls = 0

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
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
              dependencyCalls += 1

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
        ],
      },
    })

    await nextTick()
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect((wrapper.vm as any).getFieldValue("orderType")).toBe("standard")
    expect(dependencyCalls).toBeGreaterThan(0)
    expect((wrapper.vm as any).getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        label: "标准订单配置",
        children: [{ name: "quantity" }],
      },
    ])
    expect(wrapper.text()).toContain("标准订单配置")
    expect(wrapper.text()).toContain("数量")

    await wrapper.get('[data-testid="selector-renderer"]').trigger("click")
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    expect(wrapper.text()).toContain("加急订单配置")
    expect(wrapper.text()).toContain("加急等级")
    expect(wrapper.text()).toContain("加急费用")

    wrapper.unmount()
  })

  it("dependencies.componentProps 更新后应同步下发给已挂载 renderer", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))
    rendererRegistry.register("rate", markRaw(CountRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        initialValues: { deliveryMethod: "express" },
        schemas: [
          {
            name: "deliveryMethod",
            label: "配送方式",
            componentType: "input",
          },
          {
            name: "serviceRating",
            label: "服务评分",
            componentType: "rate",
            dependencies: {
              triggerFields: ["deliveryMethod"],
              componentProps: ((values: { deliveryMethod?: string }) => {
                const countMap: Record<string, number> = {
                  express: 5,
                  selfPickup: 3,
                  other: 7,
                }

                return {
                  count: countMap[values.deliveryMethod as string] ?? 5,
                }
              }) as any,
            },
          },
        ],
      },
    })

    await nextTick()
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(wrapper.get('[data-testid="count-renderer"]').attributes("data-count")).toBe(
      "5"
    )

    ;(wrapper.vm as any).setFieldValue("deliveryMethod", "selfPickup")
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    expect(wrapper.get('[data-testid="count-renderer"]').attributes("data-count")).toBe(
      "3"
    )

    wrapper.unmount()
  })

  it("以可见 Group 作为顶层字段区段边界", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            label: "分组一",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          { name: "name", label: "姓名", componentType: "input" },
          {
            label: "分组二",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element

    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    const groupItemWrappers = wrapper.findAll(".schemx-group__body .schemx-item-wrapper")

    expect(groupItemWrappers).toHaveLength(2)
    for (const itemWrapper of groupItemWrappers) {
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--first")
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--last")
    }

    wrapper.unmount()
  })

  it("查找首尾样式类时跳过不可见项，但不跨越可见 Group", async () => {
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            label: "前置分组",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          {
            name: "hiddenBefore",
            label: "隐藏前项",
            componentType: "input",
            visible: false,
          },
          { name: "name", label: "姓名", componentType: "input" },
          {
            label: "中间分组",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
          {
            name: "hiddenAfter",
            label: "隐藏后项",
            componentType: "input",
            visible: false,
          },
          {
            label: "后置分组",
            children: [{ name: "postcode", label: "邮编", componentType: "input" }],
          },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element

    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    wrapper.unmount()
  })
})
