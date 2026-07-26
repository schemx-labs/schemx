/**
 * FormItem 集成测试
 *
 * 验证 FormItem 组件与 core 处理后的 ViewSchema 的集成行为：
 * - 新格式 Dependency_Object 由 core 解析并驱动动态渲染
 * - 无 dependencies 时静态值直接生效
 *
 * @module components/FormItem/__tests__/FormItem
 */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { defineComponent, h, nextTick } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { WithRemoteOptions } from "@/hocs/withRemoteOptions"
import {
  type FormContextProps,
  SCHEMX_FORM_CONFIG_KEY,
} from "@/hooks/provideFormConfigContext"
import { SCHEMX_FORM_INSTANCE_KEY } from "@/hooks/provideFormContext"

import FormItem from "../index"

import type { SchemxBaseField, SchemxInstance } from "@schemx/core"

/**
 * 创建最小化的 FormContext 配置
 */
function createFormContext(overrides?: Partial<FormContextProps>): FormContextProps {
  return {
    schemas: [],
    labelPosition: "left",
    labelAlign: "left",
    contentAlign: "left",
    colon: false,
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

describe("FormItem 集成测试", () => {
  it("Dictionary HOC 脱离 FormItem 时仍可使用显式 fieldName", async () => {
    const form: SchemxInstance = createForm({
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
    const form: SchemxInstance = createForm({
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
          },
        },
      ],
    })

    form.registerRenderer("dictionary" as any, DictionaryRendererWithRemoteOptions)

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      initialValues: { province: "guangdong" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)
    await form.waitForDependencies()

    const wrapper = mount(FormItem, {
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
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(true)

    // 将 province 设为空字符串
    form.setFieldValue("province", "")
    await form.waitForDependencies()
    await wrapper.setProps({ schema: form.getViewSchemas()[0] })
    await nextTick()

    // province 为空 → visible 应为 false → 组件不应渲染
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it("无 dependencies 时静态 visible: false 直接生效，组件不渲染", async () => {
    const form: SchemxInstance = createForm({
      initialValues: { name: "" },
    })

    form.registerRenderer("input", InputRenderer)

    const schema: SchemxBaseField = {
      name: "name",
      label: "姓名",
      componentType: "input" as any,
      visible: false,
    }

    const wrapper = mount(FormItem, {
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
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(false)

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

    const form: SchemxInstance = createForm({
      initialValues: { pickupStore: "hubin" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      initialValues: { website: "www.baidu.com" },
      schemas: [schema as any],
    })

    form.registerRenderer("controlled" as any, ControlledRenderer)

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      schemas: [schema as any],
    })

    form.registerRenderer("change" as any, ChangeRenderer)

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
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

    const form: SchemxInstance = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
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
    expect(wrapper.find(".schemx-item__required").exists()).toBe(false)
    expect(wrapper.find(".schemx-item.is-readonly").exists()).toBe(true)

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

    const form: SchemxInstance = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find(".schemx-item__required").exists()).toBe(false)

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("")
    await input.trigger("blur")

    expect(validateSpy).toHaveBeenCalledTimes(2)
    expect(validateSpy).toHaveBeenCalledWith("title")

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

    const form: SchemxInstance = createForm({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find(".schemx-item__required").exists()).toBe(true)

    const input = wrapper.get('[data-testid="probe-renderer"]')

    await input.setValue("")
    await input.trigger("blur")

    expect(validateSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    form.destroy()
  })

  it.each(["disabled", "readonly"])(
    "%s 时即使 showRequiredMark=true 也不显示必填星号",
    async (state) => {
      const form: SchemxInstance = createForm({
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

      const wrapper = mount(FormItem, {
        props: { schema: form.getViewSchemas()[0] },
        global: {
          provide: {
            [SCHEMX_FORM_INSTANCE_KEY]: form,
            [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
          },
        },
      })

      await nextTick()

      expect(wrapper.find(".schemx-item__required").exists()).toBe(false)

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
    const form: SchemxInstance = createForm({
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

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [SCHEMX_FORM_INSTANCE_KEY]: form,
          [SCHEMX_FORM_CONFIG_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    expect(wrapper.find(".schemx-item__required").exists()).toBe(expected)

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

    const form: SchemxInstance = createForm({
      initialValues: { deliveryMethod: "express", quantity: "1" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    await form.waitForDependencies()

    const wrapper = mount(FormItem, {
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
    await wrapper.setProps({ schema: form.getViewSchemas()[0] })
    await nextTick()

    const input = wrapper.get('[data-testid="probe-renderer"]')

    expect(input.attributes("data-disabled")).toBe("true")
    expect(input.attributes("data-form-item-disabled")).toBe("true")

    wrapper.unmount()
    form.destroy()
  })
})
