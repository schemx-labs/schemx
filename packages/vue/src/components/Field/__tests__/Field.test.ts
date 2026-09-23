/**
 * Field 集成测试
 *
 * 验证 Field 组件与 core 处理后的 ViewSchema 的集成行为：
 * - 新格式 Dependency_Object 由 core 解析并驱动动态渲染
 * - 无 dependencies 时静态值直接生效
 *
 * @module components/Field/__tests__/Field
 */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { defineComponent, h, nextTick } from "vue"
import type { Component } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import {
  type FormConfigContextValue,
  SCHEMX_FORM_CONFIG_KEY,
  SCHEMX_FORM_INSTANCE_KEY,
} from "@/context/formContext"
import { WithRemoteOptions } from "@/hocs/withRemoteOptions"

import Field from "../index"

import type {
  SchemxFieldContentSlotProps,
  SchemxFieldSlotValue,
} from "../../../types/field"
import type { RendererPropsTransformer, SchemxBaseField } from "@schemx/core"

/**
 * 创建最小化的 FormContext 配置
 */
function createFormContext(
  overrides?: Partial<FormConfigContextValue>
): FormConfigContextValue {
  return {
    schemaConfig: {
      labelPosition: "left",
      labelAlign: "left",
      contentAlign: "left",
      colon: false,
    },
    ...overrides,
  }
}

/**
 * 简单的 input 渲染器组件
 */
const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

const ControlledRenderer = defineComponent({
  name: "ControlledRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  emits: ["update:value"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        "data-testid": "controlled-renderer",
        value: props.value,
        onInput: (event: Event) => {
          emit("update:value", (event.target as HTMLInputElement).value)
        },
      })
  },
})

const TransformRenderer = defineComponent({
  name: "TransformRenderer",
  props: {
    value: String,
    placeholder: String,
  },
  setup(props) {
    return () =>
      h("input", {
        "data-testid": "transform-renderer",
        value: props.value,
        placeholder: props.placeholder,
      })
  },
})

const ChangeRenderer = defineComponent({
  name: "ChangeRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  setup(props) {
    return () =>
      h("input", {
        "data-testid": "change-renderer",
        value: props.value,
        onInput: (event: Event) => {
          props.onChange?.((event.target as HTMLInputElement).value)
        },
      })
  },
})

const ProbeRenderer = defineComponent({
  name: "ProbeRenderer",
  props: {
    value: String,
    readonly: Boolean,
    disabled: Boolean,
    formItemProps: Object,
    onChange: Function,
    onBlur: Function,
  },
  setup(props) {
    return () =>
      h("input", {
        "data-testid": "probe-renderer",
        "data-readonly": String(props.readonly),
        "data-disabled": String(props.disabled),
        "data-form-item-disabled": String((props.formItemProps as any)?.disabled),
        value: props.value,
        onInput: (event: Event) => {
          props.onChange?.((event.target as HTMLInputElement).value)
        },
        onBlur: (event: FocusEvent) => {
          props.onBlur?.(event)
        },
      })
  },
})

const DictionaryRenderer = defineComponent({
  name: "DictionaryRenderer",
  props: {
    options: Array,
    loading: Boolean,
  },
  setup() {
    return () => h("div", { "data-testid": "dictionary-renderer" })
  },
})

const DictionaryRendererWithRemoteOptions = WithRemoteOptions(DictionaryRenderer)

describe("Field 集成测试", () => {
  it("在创建 Renderer 前使用 transformProps 返回最终 Props", () => {
    const form = createForm({
      initialValues: { name: "Schemx" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input" as any,
          placeholder: "请输入姓名",
        } as any,
      ],
    })

    const transformProps = vi.fn<RendererPropsTransformer>((props, context) => {
      expect(props.placeholder).toBe("请输入姓名")
      expect(context.form).toBe(form)
      expect(context.schema.name).toBe("name")

      return { placeholder: "转换后的占位符" }
    })

    form.registerRenderer("input", {
      component: TransformRenderer,
      transformProps,
    })

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    const input = wrapper.get<HTMLInputElement>('[data-testid="transform-renderer"]')

    expect(input.attributes("placeholder")).toBe("转换后的占位符")
    expect(input.attributes("value")).toBeUndefined()
    expect(transformProps).toHaveBeenCalled()

    wrapper.unmount()
    form.destroy()
  })

  it("在字段响应式 Props 变化后重新执行 transformProps", async () => {
    const form = createForm({
      initialValues: { name: "one" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input" as any,
          placeholder: "请输入姓名",
        } as any,
      ],
    })

    const transformProps: RendererPropsTransformer = (props) => ({
      ...props,
      placeholder: `${props.placeholder}:${props.value}`,
    })

    form.registerRenderer("input", {
      component: TransformRenderer,
      transformProps,
    })

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    expect(
      wrapper.get('[data-testid="transform-renderer"]').attributes("placeholder")
    ).toBe("请输入姓名:one")

    form.setFieldValue("name", "two")
    await nextTick()

    expect(
      wrapper.get('[data-testid="transform-renderer"]').attributes("placeholder")
    ).toBe("请输入姓名:two")

    wrapper.unmount()
    form.destroy()
  })

  it("字段整体插槽应更新当前字段值，并保留扩展区和默认错误区", async () => {
    const schema: SchemxBaseField = {
      name: "website",
      label: "个人网站",
      componentType: "input" as any,
      class: "schema-website",
      style: { color: "red" },
      contentAlign: "left",
    }

    const form = createForm({
      initialValues: { website: "schemx.dev" },
      schemas: [schema as any],
    })

    form.registerRenderer("input" as any, InputRenderer)

    const wrapper = mount(Field as Component, {
      props: {
        schema: form.getViewSchemas()[0],
        class: "parent-website",
        style: { color: "blue", marginTop: "4px" },
      },
      attrs: {
        "data-testid": "website-wrapper",
      },
      slots: {
        websiteBefore: () => h("span", { "data-testid": "before-slot" }),
        website: (slotProps: SchemxFieldSlotValue) =>
          h("span", { "data-testid": "website-slot" }, String(slotProps.value ?? "")),
        websiteAfter: () => h("span", { "data-testid": "after-slot" }),
      },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    const fieldWrapper = wrapper.get('[data-testid="website-wrapper"]')

    expect(fieldWrapper.classes()).toContain("schemx-field-wrapper")
    expect(fieldWrapper.classes()).toContain("parent-website")
    expect(fieldWrapper.classes()).toContain("schema-website")
    expect(fieldWrapper.attributes("style")).toContain("color: red")
    expect(fieldWrapper.attributes("style")).toContain("margin-top: 4px")
    expect(fieldWrapper.attributes("style")).toContain("--schemx-content-align: left")
    expect(fieldWrapper.attributes("style")).toContain("--schemx-error-align: left")
    expect(wrapper.find(".schemx-field").exists()).toBe(false)
    expect(wrapper.get('[data-testid="website-slot"]').text()).toBe("schemx.dev")
    expect(wrapper.find(".schemx-field__error").exists()).toBe(false)

    form.setFieldValue("website", "schema-form.dev")
    form.setFieldErrors("website", ["网址格式错误", "第二条错误"])
    await nextTick()

    expect(wrapper.get('[data-testid="website-slot"]').text()).toBe("schema-form.dev")
    expect(wrapper.get(".schemx-field__error").text()).toBe("网址格式错误")
    expect(Array.from(fieldWrapper.element.children)).toEqual([
      wrapper.get('[data-testid="before-slot"]').element,
      wrapper.get('[data-testid="website-slot"]').element,
      wrapper.get(".schemx-field__error").element,
      wrapper.get('[data-testid="after-slot"]').element,
    ])

    form.clearFieldErrors("website")
    await nextTick()

    expect(wrapper.find(".schemx-field__error").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it.each(["left", "top"] as const)(
    "应按顺序渲染字段各区域插槽（标签在 %s）",
    (labelPosition) => {
      const slotProps: Record<string, SchemxFieldSlotValue> = {}

      const form = createForm({
        initialValues: { "profile.name": "Schemx" },
        schemas: [
          {
            name: "profile.name",
            label: "名称",
            labelPosition,
            labelWidth: 96.5,
            labelAlign: "right",
            componentType: "input",
          } as any,
        ],
      })

      form.registerRenderer("input", InputRenderer)

      const wrapper = mount(Field as Component, {
        props: { schema: form.getViewSchemas()[0] },
        slots: {
          "profile.nameLabel": (props: SchemxFieldSlotValue) => {
            slotProps.label = props

            return h("span", { "data-testid": "label-slot" })
          },
          "profile.nameBefore": (props: SchemxFieldSlotValue) => {
            slotProps.before = props

            return h("span", { "data-testid": "before-slot" })
          },
          "profile.nameContent": (props: SchemxFieldSlotValue) => {
            slotProps.content = props

            return h("div", { "data-testid": "content-slot" }, [
              (props as SchemxFieldContentSlotProps).columnElement,
            ])
          },
          "profile.nameAfter": (props: SchemxFieldSlotValue) => {
            slotProps.after = props

            return h("span", { "data-testid": "after-slot" })
          },
          "profile.nameError": (props: SchemxFieldSlotValue) => {
            slotProps.error = props

            return h("span", { "data-testid": "error-slot" })
          },
        },
        global: {
          provide: {
            [SCHEMX_FORM_INSTANCE_KEY]: form,
            [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
          },
        },
      })

      for (const name of ["label", "before", "content", "after", "error"]) {
        expect(wrapper.find(`[data-testid="${name}-slot"]`).exists()).toBe(true)
        expect(slotProps[name].schema).toEqual(form.getViewSchemas()[0])
        expect(slotProps[name].componentProps).toEqual(expect.any(Object))
        expect(slotProps[name].value).toBe("Schemx")
        expect(slotProps[name].field).toBeDefined()
        expect(slotProps[name].form).toBe(form)
      }

      expect(
        (slotProps.content as SchemxFieldContentSlotProps).columnElement
      ).toBeDefined()
      expect((slotProps.error as { errors: readonly string[] }).errors).toEqual([])
      expect(
        wrapper.find(".schemx-field__label > [data-testid='label-slot']").exists()
      ).toBe(true)
      expect(
        wrapper.find(".schemx-field__content > [data-testid='content-slot']").exists()
      ).toBe(true)
      expect(
        wrapper.find(".schemx-field__error > [data-testid='error-slot']").exists()
      ).toBe(true)
      expect(wrapper.get<HTMLElement>(".schemx-field__label").element.style.width).toBe(
        labelPosition === "top" ? "100%" : "96.5px"
      )
      expect(
        wrapper.get<HTMLElement>(".schemx-field__label").element.style.textAlign
      ).toBe(labelPosition === "top" ? "left" : "right")
      expect(Array.from(wrapper.get(".schemx-field-wrapper").element.children)).toEqual([
        wrapper.get('[data-testid="before-slot"]').element,
        wrapper.get(".schemx-field").element,
        wrapper.get(".schemx-field__error").element,
        wrapper.get('[data-testid="after-slot"]').element,
      ])

      wrapper.unmount()
      form.destroy()
    }
  )

  it("应合并内部、父级和 Schema 的 class/style 到字段容器", () => {
    const form = createForm({
      initialValues: { username: "Schemx" },
      schemas: [
        {
          name: "username",
          label: "用户名",
          componentType: "input",
          class: "schema-item",
          style: { color: "red" },
        } as any,
      ],
    })

    form.registerRenderer("input", InputRenderer)

    const wrapper = mount(Field, {
      props: {
        schema: form.getViewSchemas()[0],
        class: "parent-item",
        style: { color: "blue", marginTop: "4px" },
      },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    const itemWrapper = wrapper.find(".schemx-field-wrapper")

    expect(itemWrapper.classes()).toContain("schemx-field-wrapper")
    expect(itemWrapper.classes()).toContain("parent-item")
    expect(itemWrapper.classes()).toContain("schema-item")
    expect(itemWrapper.attributes("style")).toContain("color: red")
    expect(itemWrapper.attributes("style")).toContain("margin-top: 4px")
    expect(wrapper.find(".schemx-field").classes()).not.toContain("schema-item")
    expect(
      wrapper.find('.schemx-field__content > [data-testid="input-renderer"]').exists()
    ).toBe(true)

    wrapper.unmount()
    form.destroy()
  })

  it("Dictionary HOC 支持直接传入 api 函数", async () => {
    const api = vi.fn().mockResolvedValue([])

    const form = createForm({ initialValues: {} })

    const wrapper = mount(DictionaryRendererWithRemoteOptions, {
      props: {
        fieldName: "city",
        dict: api,
      },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
        },
      },
    })

    await nextTick()

    expect(api).toHaveBeenCalledWith({}, form)

    wrapper.unmount()
    form.destroy()
  })

  it("Dictionary HOC 脱离 Field 时仍可使用显式 fieldName", async () => {
    const form = createForm({
      initialValues: { province: "GD", city: "Guangzhou" },
    })

    const wrapper = mount(DictionaryRendererWithRemoteOptions, {
      props: {
        fieldName: "city",
        dict: {
          api: vi.fn().mockResolvedValue([]),
          dependsOn: ["province"],
          resetOnDepsChange: true,
          immediate: false,
        },
      },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
        },
      },
    })

    form.setFieldValue("province", "ZJ")
    await nextTick()

    expect(form.getFieldValue("city")).toBeUndefined()

    wrapper.unmount()
    form.destroy()
  })

  it("Dictionary Renderer 应在依赖字段变化时自动清空自身字段值", async () => {
    const form = createForm({
      initialValues: { province: "GD", city: "Guangzhou" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "dictionary" as any,
          componentProps: {
            dict: {
              api: vi.fn().mockResolvedValue([]),
              dependsOn: ["province"],
              resetOnDepsChange: true,
              immediate: false,
            },
          } as any,
        },
      ],
    })

    form.registerRenderer("dictionary" as any, DictionaryRendererWithRemoteOptions)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()
    form.setFieldValue("province", "ZJ")
    await nextTick()

    expect(form.getFieldValue("city")).toBeUndefined()

    wrapper.unmount()
    form.destroy()
  })

  it("ViewSchema 驱动 visible 随依赖字段变化", async () => {
    const schema: SchemxBaseField = {
      name: "city",
      label: "城市",
      componentType: "input" as any,
      dependencies: {
        triggerFields: ["province"],
        visible: (values: any) => !!values.province,
      },
    }

    const form = createForm({
      initialValues: { province: "guangdong" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)
    await form.waitForDependencies()

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    // province 有值 → visible 应为 true → 组件应渲染
    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(true)

    // 将 province 设为空字符串
    form.setFieldValue("province", "")
    await form.waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    // province 为空 → visible 应为 false → 组件不应渲染
    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it("无 dependencies 时静态 visible: false 直接生效，组件不渲染", async () => {
    const form = createForm({
      initialValues: { name: "" },
    })

    form.registerRenderer("input", InputRenderer)

    const schema: SchemxBaseField = {
      name: "name",
      label: "姓名",
      componentType: "input" as any,
      visible: false,
    }

    const wrapper = mount(Field, {
      props: { schema },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    // visible 为 false（静态值），组件不应渲染
    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it("字段挂载时不应使用 schema initialValue 覆盖已存在的字段值", async () => {
    const schema: SchemxBaseField = {
      name: "pickupStore",
      label: "自提门店",
      componentType: "input" as any,
      initialValue: "mixc",
    }

    const form = createForm({
      initialValues: { pickupStore: "hubin" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()
    await Promise.resolve()

    expect(form.getFieldValue("pickupStore")).toBe("hubin")

    wrapper.unmount()
    form.destroy()
  })

  it("向受控 renderer 下发字段值，并将 update:value 写回 store", async () => {
    const schema: SchemxBaseField = {
      name: "website",
      label: "个人网站",
      componentType: "controlled" as any,
    }

    const form = createForm({
      initialValues: { website: "www.baidu.com" },
      schemas: [schema as any],
    })

    form.registerRenderer("controlled" as any, ControlledRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const input = wrapper.get<HTMLInputElement>('[data-testid="controlled-renderer"]')

    expect(input.element.value).toBe("www.baidu.com")

    await input.setValue("schemx.dev")

    expect(form.getFieldValue("website")).toBe("schemx.dev")

    wrapper.unmount()
    form.destroy()
  })

  it("将 renderer 的 onChange 值写回 store", async () => {
    const schema: SchemxBaseField = {
      name: "bio",
      label: "个人简介",
      componentType: "change" as any,
    }

    const form = createForm({
      schemas: [schema as any],
    })

    form.registerRenderer("change" as any, ChangeRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    await wrapper.get('[data-testid="change-renderer"]').setValue("新的简介")

    expect(form.getFieldValue("bio")).toBe("新的简介")

    wrapper.unmount()
    form.destroy()
  })

  it("validationTrigger=onChange 时值变化后触发字段校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      required: true,
      validationTrigger: "onChange",
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()
    await wrapper.get('[data-testid="probe-renderer"]').setValue("")

    expect(validateSpy).toHaveBeenCalledWith("title")

    wrapper.unmount()
    form.destroy()
  })

  it("validationTrigger=onBlur 时失焦后触发字段校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      required: true,
      validationTrigger: "onBlur",
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("")
    expect(validateSpy).not.toHaveBeenCalled()

    await input.trigger("blur")
    expect(validateSpy).toHaveBeenCalledWith("title")

    wrapper.unmount()
    form.destroy()
  })

  it("readonly=true 时下发给 renderer、隐藏 required 星号并跳过校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      readonly: true,
      required: true,
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const input = wrapper.get('[data-testid="probe-renderer"]')

    expect(input.attributes("data-readonly")).toBe("true")
    expect(input.attributes("data-disabled")).toBe("false")
    expect(wrapper.find(".is-required").exists()).toBe(false)
    expect(wrapper.find(".schemx-field.is-readonly").exists()).toBe(true)

    await input.setValue("")
    await input.trigger("blur")

    expect(form.getFieldValue("title")).toBe("")
    expect(validateSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    form.destroy()
  })

  it("required=true 默认显示必填星号，showRequiredMark=false 只隐藏星号且仍按 change/blur 校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      required: true,
      showRequiredMark: false,
      validationTrigger: ["onChange", "onBlur"],
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find(".is-required").exists()).toBe(false)

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("")
    await input.trigger("blur")

    expect(validateSpy).toHaveBeenCalledTimes(2)
    expect(validateSpy).toHaveBeenCalledWith("title")

    wrapper.unmount()
    form.destroy()
  })

  it("Vue Field 应调用 Schema 顶层 onChange 和 onBlur 回调", async () => {
    const onChange = vi.fn()

    const onBlur = vi.fn()

    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      onChange,
      onBlur,
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("新标题")
    await input.trigger("blur")

    expect(onChange).toHaveBeenCalledWith("新标题", form)
    expect(onBlur).toHaveBeenCalledWith(form)

    wrapper.unmount()
    form.destroy()
  })

  it("labelIcon 应渲染在标签文本之前", async () => {
    const form = createForm({
      schemas: [
        {
          name: "title",
          label: "标题",
          labelIcon: "!",
          colon: false,
          componentType: "input" as any,
        },
      ],
    })

    form.registerRenderer("input" as any, InputRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const label = wrapper.get(".schemx-field__label")

    expect(label.get(".schemx-field__label-icon").text()).toBe("!")
    expect(label.get(".schemx-field__label-text").text()).toBe("标题")

    wrapper.unmount()
    form.destroy()
  })

  it("标签图标支持直接传入 Vue Component", async () => {
    const LabelIcon = defineComponent({
      name: "LabelIcon",
      setup() {
        return () => h("i", { "data-testid": "label-icon-component" }, "icon")
      },
    })

    const form = createForm({
      schemas: [
        {
          name: "title",
          label: "标题",
          labelIcon: LabelIcon,
          colon: false,
          componentType: "input" as any,
        },
      ],
    })

    form.registerRenderer("input" as any, InputRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find("[data-testid='label-icon-component']").exists()).toBe(true)

    wrapper.unmount()
    form.destroy()
  })

  it("required=false 且 showRequiredMark=true 时显示星号，但不会触发 required 校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      required: false,
      showRequiredMark: true,
      validationTrigger: ["onChange", "onBlur"],
    }

    const form = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const labelText = wrapper.get(".schemx-field__label-text")

    expect(labelText.classes()).toContain("is-required")

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("")
    await input.trigger("blur")

    expect(validateSpy).toHaveBeenCalledTimes(2)
    expect(form.getFieldErrors("title")).toEqual([])

    wrapper.unmount()
    form.destroy()
  })

  it.each(["disabled", "readonly"])(
    "%s 时即使 showRequiredMark=true 也不显示必填星号",
    async (state) => {
      const form = createForm({
        schemas: [
          {
            name: "title",
            label: "标题",
            componentType: "input" as any,
            required: false,
            showRequiredMark: true,
            [state]: true,
          } as any,
        ],
      })

      form.registerRenderer("input", InputRenderer)

      const wrapper = mount(Field, {
        props: { schema: form.getViewSchemas()[0] },
        global: {
          provide: {
            [SCHEMX_FORM_INSTANCE_KEY]: form,
            [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
          },
        },
      })

      await nextTick()

      expect(wrapper.find(".is-required").exists()).toBe(false)

      wrapper.unmount()
      form.destroy()
    }
  )

  it.each([
    ["普通 rules", { rules: { validate: () => ({ valid: true as const }) } }, false],
    ["required=true", { required: true }, true],
    ["RequiredOptions", { required: { message: "请输入标题" } }, true],
    ["disabled required", { required: true, disabled: true }, false],
  ])("%s 的必填标记符合 required 语义", async (_name, schemaOptions, expected) => {
    const form = createForm({
      schemas: [
        {
          name: "title",
          label: "标题",
          componentType: "probe" as any,
          ...schemaOptions,
        },
      ],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find(".is-required").exists()).toBe(expected)

    wrapper.unmount()
    form.destroy()
  })

  it("dependencies 更新 disabled 后应同步下发给 renderer 与 formItemProps", async () => {
    const schema: SchemxBaseField = {
      name: "quantity",
      label: "数量",
      componentType: "probe" as any,
      dependencies: {
        triggerFields: ["deliveryMethod"],
        disabled: (values: any) => values.deliveryMethod === "selfPickup",
      },
    }

    const form = createForm({
      initialValues: { deliveryMethod: "express", quantity: "1" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    await form.waitForDependencies()

    const wrapper = mount(Field, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(
      wrapper.get('[data-testid="probe-renderer"]').attributes("data-disabled")
    ).toBe("false")

    form.setFieldValue("deliveryMethod", "selfPickup")
    await form.waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    const input = wrapper.get('[data-testid="probe-renderer"]')

    expect(input.attributes("data-disabled")).toBe("true")
    expect(input.attributes("data-form-item-disabled")).toBe("true")

    wrapper.unmount()
    form.destroy()
  })
})
