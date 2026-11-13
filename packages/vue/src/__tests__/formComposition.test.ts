import { defineComponent, h, markRaw, nextTick, onMounted, ref } from "vue"
import type { Component } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import { createFormComponent, createSchemx, createSearchComponent } from "../index"

import type { SchemxInstance, Values } from "../index"

// 同一组业务契约同时验证 Form 和 Search，不依赖共享渲染组件的内部节点结构。
const variants = [
  { name: "Form", create: createFormComponent },
  { name: "Search", create: createSearchComponent },
]

// create 是当前公开入口的组件创建器。
describe.each(variants)("$name 的共享表单接入", ({ create }) => {
  it("适配标识绑定当前入口，复制后保留且不传播到其他入口", () => {
    // 三个入口共用创建器，UI 标识仍按组件定义分别保存。
    const api = createSchemx()

    // 带有桌面适配标识的入口。
    const ElementForm = create(api.createForm, "ElementForm", "element-plus")

    // 带有移动端适配标识的入口。
    const VantForm = create(api.createForm, "VantForm", "vant")

    // 未绑定 UI 的公共入口。
    const PlainForm = create(api.createForm, "PlainForm")

    // 复制组件选项仍应保留可枚举的入口元数据。
    const copied = Object.assign({}, ElementForm)

    // 同时挂载三个入口以核对各自的根节点属性。
    const wrappers = [copied, VantForm, PlainForm].map(
      // component 是本次需要验证独立主题标识的入口。
      (component) => mount(component, { props: { submitter: false, resetter: false } })
    )

    expect(wrappers[0]?.attributes("data-schemx-ui")).toBe("element-plus")
    expect(wrappers[1]?.attributes("data-schemx-ui")).toBe("vant")
    expect(wrappers[2]?.attributes("data-schemx-ui")).toBeUndefined()
    // wrapper 是当前测试挂载的表单，逐个卸载释放其独立实例。
    wrappers.forEach((wrapper) => wrapper.unmount())
  })

  it("父级 mounted 时 ref 已可用，模型同步、提交和实例销毁各执行一次", async () => {
    // 各入口使用独立 Registry，避免修改默认注册表。
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register(
      "input",
      markRaw(defineComponent({ setup: () => () => h("input") }))
    )
    // 绑定工厂以记录创建次数，并验证配置没有被第二次创建覆盖。
    const api = createSchemx({ rendererRegistry, schemaConfig: { labelWidth: 88 } })

    // 内部实际创建的原始实例。
    const createForm = vi.spyOn(api, "createForm")

    // 两种入口通过共享接入逻辑提供完整 API。
    const Form: Component = create(api.createForm)

    // 公开组件 ref，在整个更新周期中保持身份稳定。
    const formRef = ref<SchemxInstance>()

    // 业务侧 v-model，初始模型同时作为重置基准。
    const values = ref<Values>({ keyword: "before" })

    // 记录父组件 mounted 阶段实际读到的值。
    let mountedValue: unknown

    // 记录公开入口发出的模型事件及提交回调。
    // next 是共享接入逻辑同步给业务侧的完整模型快照。
    const onUpdate = vi.fn((next: Values) => {
      values.value = next
    })

    const onFinish = vi.fn()

    // 由父组件消费公开 ref，与实际业务挂载顺序一致。
    const Host = defineComponent({
      setup() {
        onMounted(() => {
          mountedValue = formRef.value?.getFieldValue("keyword")
        })

        return () =>
          h(Form, {
            ref: formRef,
            modelValue: values.value,
            "onUpdate:modelValue": onUpdate,
            onFinish,
            schemas: [{ name: "keyword", label: "关键词", componentType: "input" }],
            class: "business-form",
            style: { width: "640px" },
            "data-contract": "shared-form",
          })
      },
    })

    // 挂载真实公开入口，验证共享渲染不增加额外 DOM 根节点。
    const wrapper = mount(Host)

    // 组件应在父级生命周期开始前同步获得完整 API。
    const instance = formRef.value

    if (!instance) {
      throw new Error("公开表单实例未初始化")
    }

    // 取消注册和后续调用都依赖方法身份稳定。
    const scrollToField = instance.scrollToField

    // 谁创建谁销毁，当前公开入口持有唯一内部实例。
    const destroy = vi.spyOn(createForm.mock.results[0]?.value, "destroy")

    expect(mountedValue).toBe("before")
    expect(createForm).toHaveBeenCalledOnce()
    expect(wrapper.get(".schemx").classes()).toContain("business-form")
    expect(wrapper.get(".schemx").attributes("style")).toContain("640px")
    expect(wrapper.get(".schemx").attributes("data-contract")).toBe("shared-form")
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain("88px")

    instance.setFieldValue("keyword", "after")
    await flushPromises()
    expect(values.value.keyword).toBe("after")
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(formRef.value).toBe(instance)
    expect(instance.scrollToField).toBe(scrollToField)
    expect(createForm).toHaveBeenCalledOnce()

    await instance.submit()
    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish).toHaveBeenCalledWith({ keyword: "after" })
    instance.reset()
    await flushPromises()
    expect(values.value.keyword).toBe("before")
    wrapper.unmount()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it("动态增删字段插槽，不与内部布局插槽冲突", async () => {
    // 使用独立的 renderer，方便辨认默认字段渲染结果。
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register(
      "input",
      markRaw(defineComponent({ setup: () => () => h("input") }))
    )
    // Form / Search 均可使用名为 layout 的业务字段。
    const Form: Component = create(createSchemx({ rendererRegistry }).createForm)

    // 模拟父组件在运行时增加或撤销自定义字段插槽。
    const custom = ref(false)

    // 每次渲染传入不同插槽集合，验证渲染层能收到最新结果。
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              Form,
              {
                schemas: [{ name: "layout", label: "业务布局", componentType: "input" }],
              },
              custom.value
                ? { layout: () => h("span", { class: "custom-field" }, "业务插槽") }
                : {}
            )
        },
      })
    )

    expect(wrapper.find("input").exists()).toBe(true)
    custom.value = true
    await nextTick()
    expect(wrapper.get(".custom-field").text()).toBe("业务插槽")
    expect(wrapper.find("input").exists()).toBe(false)
    custom.value = false
    await nextTick()
    expect(wrapper.find(".custom-field").exists()).toBe(false)
    expect(wrapper.find("input").exists()).toBe(true)
    wrapper.unmount()
  })
})

describe("Form 的根级操作区", () => {
  it("操作列只追加到根行，Group 和 Dynamic 仍接收同名字段插槽", () => {
    // 使用独立 Registry 验证普通字段和递归字段都可正常渲染。
    const rendererRegistry = createRendererRegistry()

    rendererRegistry.register(
      "input",
      markRaw(defineComponent({ setup: () => () => h("input") }))
    )
    // 当前工厂提供普通 Form 入口。
    const Form = createFormComponent(createSchemx({ rendererRegistry }).createForm)

    // 递归层级中的字段均命名为 default，验证它们不会消费根级行尾插槽。
    const wrapper = mount(Form, {
      props: {
        initialValues: { default: "root", users: [{ default: "nested" }] },
        schemas: [
          {
            key: "details",
            label: "详情",
            children: [{ name: "default", label: "默认字段", componentType: "input" }],
          },
          {
            key: "users-list",
            name: "users",
            item: [{ name: "default", label: "默认字段", componentType: "input" }],
          },
        ],
      },
      slots: {
        default: () => h("span", { class: "custom-default-field" }, "自定义字段"),
        "users.0.default": () => h("span", { class: "custom-default-field" }, "列表字段"),
      },
    })

    expect(wrapper.findAll(".custom-default-field")).toHaveLength(2)
    expect(wrapper.findAll(".schemx-actions")).toHaveLength(1)
    expect(wrapper.findAll(".schemx-actions-button--submit")).toHaveLength(1)
    expect(wrapper.findAll(".schemx-actions-button--reset")).toHaveLength(1)
    expect(wrapper.get(".schemx-actions").element.closest(".schemx-schema-list")).toBe(
      wrapper.get(".schemx > .schemx-schema-list").element
    )
    wrapper.unmount()
  })
})
